import { test, expect } from "@playwright/test";
const API = `http://127.0.0.1:${process.env.E2E_API_PORT || "4317"}`;
const headers = { Authorization: "Bearer local-e2e-token" };

test.use({
  video: { mode: "on", size: { width: 390, height: 844 } },
  // The earlier runs are placed in this machine's days, so the browser's week must be the same.
  timezoneId: Intl.DateTimeFormat().resolvedOptions().timeZone,
});

const progress = (streak: number, extra: Record<string, unknown> = {}) => ({
  weeks: [],
  achievement: { streak },
  habitAchievement: { isAchieved: streak >= 4 && streak < 9, maxValue: 4, progressValue: Math.min(streak, 4) },
  lifestyleAchievement: { isAchieved: streak >= 9, maxValue: 9, progressValue: Math.min(streak, 9) },
  ...extra,
});

async function setUp(request: any, theme: string, planProgress: unknown) {
  await request.post(`${API}/__reset`);
  await request.patch(`${API}/users/user`, { headers, data: { themeMode: theme } });
  await request.post(`${API}/__plan-nudges`, { headers, data: {} });
  await request.post(`${API}/__plan-progress`, { headers, data: { planId: "half", progress: planProgress } });
}

// "Run my first half marathon" is 3 runs a week; two earlier runs this week, so this log finishes the week.
async function logThirdRun(page: any) {
  const now = new Date();
  const earlier = [1, 2].map((n, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - n);
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

const milestoneShown = (page: any) =>
  expect(page.getByTestId("log-celebration-milestone").locator("xpath=..")).toHaveCSS("opacity", "1", { timeout: 15000 });

for (const theme of ["DARK", "LIGHT"]) {
  test(`the week that makes 4 in a row goes straight on to Habit formed in ${theme}`, async ({ page, request }) => {
    test.setTimeout(60000);
    test.skip(new Date().getDay() < 3, "needs two earlier days in this week");
    await setUp(request, theme, progress(3));
    await logThirdRun(page);
    await expect(page.getByTestId("log-celebration-week")).toHaveCSS("opacity", "1", { timeout: 10000 });
    await milestoneShown(page);
    await expect(page.getByTestId("log-celebration-milestone")).toHaveText("Habit formed!");
    await expect(page.getByTestId("log-celebration-milestone-weeks")).toHaveText("4 weeks in a row");
    await page.waitForTimeout(1400);
    await page.screenshot({ path: `test-results/habit-celebration-${theme}.png` });
    await expect(page.getByTestId("log-celebration")).toHaveCount(0, { timeout: 15000 });
    await expect(page.getByTestId("saved-share-more")).toBeVisible();
    expect(await (await request.get(`${API}/__milestones-celebrated`, { headers })).json()).toEqual([{ planId: "half", kind: "habit" }]);
  });
}

test("the week that makes 9 in a row is a lifestyle", async ({ page, request }) => {
  test.setTimeout(60000);
  test.skip(new Date().getDay() < 3, "needs two earlier days in this week");
  await setUp(request, "DARK", progress(8));
  await logThirdRun(page);
  await milestoneShown(page);
  await expect(page.getByTestId("log-celebration-milestone")).toHaveText("It's a lifestyle!");
  await expect(page.getByTestId("log-celebration-milestone-weeks")).toHaveText("9 weeks in a row");
  await page.waitForTimeout(1400);
  await page.screenshot({ path: `test-results/lifestyle-celebration-DARK.png` });
  await expect(page.getByTestId("log-celebration")).toHaveCount(0, { timeout: 15000 });
});

test("a week done that earns nothing has no badge act", async ({ page, request }) => {
  test.setTimeout(60000);
  test.skip(new Date().getDay() < 3, "needs two earlier days in this week");
  await setUp(request, "DARK", progress(5));
  await logThirdRun(page);
  await expect(page.getByTestId("log-celebration-week")).toHaveCSS("opacity", "1", { timeout: 10000 });
  await expect(page.getByTestId("log-celebration-milestone")).toHaveCount(0);
  await expect(page.getByTestId("log-celebration")).toHaveCount(0, { timeout: 15000 });
});

for (const theme of ["DARK", "LIGHT"]) {
  test(`a badge earned elsewhere plays once on opening the app in ${theme}`, async ({ page, request }) => {
    test.setTimeout(60000);
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    await setUp(request, theme, progress(4, { habitAchievement: { isAchieved: true, maxValue: 4, progressValue: 4, achievedAt: yesterday } }));
    await page.goto("/");
    await milestoneShown(page);
    await expect(page.getByTestId("log-celebration-milestone")).toHaveText("Habit formed!");
    await expect(page.getByTestId("log-celebration-nice")).toHaveCount(0);
    await page.waitForTimeout(1400);
    await page.screenshot({ path: `test-results/habit-recap-${theme}.png` });
    await expect(page.getByTestId("log-celebration")).toHaveCount(0, { timeout: 15000 });
    expect(await (await request.get(`${API}/__milestones-celebrated`, { headers })).json()).toEqual([{ planId: "half", kind: "habit" }]);
    await page.reload();
    await expect(page.getByTestId("home-screen").or(page.locator("body"))).toBeVisible();
    await page.waitForTimeout(4000);
    await expect(page.getByTestId("log-celebration")).toHaveCount(0);
  });
}

test("old badges are not recapped", async ({ page, request }) => {
  await setUp(request, "DARK", progress(10, { lifestyleAchievement: { isAchieved: true, maxValue: 9, achievedAt: "2026-01-01T00:00:00.000Z" } }));
  await page.goto("/");
  await page.waitForTimeout(4000);
  await expect(page.getByTestId("log-celebration")).toHaveCount(0);
});
