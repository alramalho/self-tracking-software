import { test, expect } from "@playwright/test";
const API = `http://127.0.0.1:${process.env.E2E_API_PORT || "4317"}`;
const headers = { Authorization: "Bearer local-e2e-token" };

// Recorded so the motion can be reviewed (test-results/<test>/video.webm).
test.use({
  video: { mode: "on", size: { width: 390, height: 844 } },
  // The earlier runs are placed in this machine's days, so the browser's week must be the same.
  timezoneId: Intl.DateTimeFormat().resolvedOptions().timeZone,
});

// The plan "Run my first half marathon" is 3 times a week. Earlier runs this week come from the entries
// route below, so the stepper starts where each case needs it (log on a new day: one step up).
async function logRun(page: any, request: any, theme: string, earlierThisWeek: number) {
  await request.post(`${API}/__reset`);
  await request.patch(`${API}/users/user`, { headers, data: { themeMode: theme } });
  await request.post(`${API}/__plan-nudges`, { headers, data: {} });
  const now = new Date();
  const earlier = Array.from({ length: earlierThisWeek }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (i + 1));
    d.setHours(8, 0, 0, 0);
    return { id: `early-${i}`, activityId: "run", userId: "test-user", datetime: d.toISOString(), createdAt: d.toISOString(), quantity: 5, comments: [], reactions: [] };
  });
  await page.route("**/activities/activity-entries", async (route: any) => {
    if (route.request().method() !== "GET") return route.continue();
    await route.fulfill({ json: earlier });
  });
  await page.goto("/add");
  await page.getByRole("button", { name: "Log Running", exact: true }).click();
  await page.getByLabel("Quantity", { exact: true }).fill("5");
  await page.getByRole("button", { name: "Log Activity", exact: true }).click();
  await page.getByRole("button", { name: "Log without photo", exact: true }).click();
}

for (const theme of ["DARK", "LIGHT"]) {
  test(`a log steps the plan up in ${theme}`, async ({ page, request }) => {
    test.skip(new Date().getDay() < 2, "needs earlier days in this week");
    await logRun(page, request, theme, 1);
    const overlay = page.getByTestId("log-celebration");
    await expect(overlay).toBeVisible();
    await expect(page.getByTestId("log-celebration-line")).toHaveText("Running · 5 km");
    await expect(page.getByText("Nice work!", { exact: true })).toBeVisible();
    await expect(page.getByTestId("log-celebration-count")).toHaveText("2 of 3 this week", { timeout: 8000 });
    await page.waitForTimeout(600);
    await page.screenshot({ path: `test-results/log-celebration-${theme}.png` });
    await expect(overlay).toHaveCount(0, { timeout: 10000 });
  });

  test(`the log that completes the week celebrates it in ${theme}`, async ({ page, request }) => {
    test.setTimeout(60000);
    test.skip(new Date().getDay() < 3, "needs two earlier days in this week");
    await logRun(page, request, theme, 2);
    await expect(page.getByTestId("log-celebration-count")).toHaveText("3 of 3 this week", { timeout: 8000 });
    await expect(page.getByText("Week done", { exact: true })).toBeVisible();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `test-results/week-celebration-${theme}.png` });
    await expect(page.getByTestId("log-celebration")).toHaveCount(0, { timeout: 15000 });
  });
}
