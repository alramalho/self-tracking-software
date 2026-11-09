import { test, expect } from "@playwright/test";
const API = `http://127.0.0.1:${process.env.E2E_API_PORT || "4317"}`;

const day = (daysAgo: number) => new Date(Date.now() - daysAgo * 86400000).toISOString();
const runs: [number, number, number | null, string][] = [
  [3, 28, 5.2, "running"],
  [8, 56, 10.1, "running"],
  [12, 34, 6.3, "running"],
  [24, 48, 8.4, "running"],
  [28, 145, null, "Hiking"],
  [31, 43, 7.2, "running"],
  [33, 31, 5.4, "running"],
  [37, 30, 5.1, "running"],
];
const items = runs.map(([ago, minutes, km, title], index) => ({
  healthWorkout: {
    id: `w${index}`,
    displayName: title,
    activityTypeName: title,
    startAt: day(ago),
    endAt: day(ago),
    durationSeconds: minutes * 60,
    distanceMeters: km == null ? null : km * 1000,
    averageHeartRateBpm: 160,
    sourceName: "Apple Watch",
  },
  category: "resolved",
  mismatches: [],
  candidates: [],
  suggestedActivity: null,
  recommendedAction: null,
  resolved: {
    action: "link_keep",
    activityEntryId: `e${index}`,
    healthDataIsPublic: false,
    linkedActivity: { title, emoji: title === "Hiking" ? "🚶" : "🏃‍♀️", measure: "minutes", quantity: minutes },
    confirmedAt: day(ago),
  },
}));

for (const theme of ["DARK", "LIGHT"]) {
  test(`runs summed per week with recent pace in ${theme}`, async ({ page, request }) => {
    await request.post(`${API}/__reset`);
    await request.patch(`${API}/users/user`, {
      headers: { Authorization: "Bearer local-e2e-token" },
      data: { themeMode: theme },
    });
    await page.route("**/health/apple/**", async (route) => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname.endsWith("/status"))
        return route.fulfill({ json: { connected: true, importStats: { workoutCount: 8 } } });
      if (pathname.endsWith("reconciliation-preview"))
        return route.fulfill({ json: { summary: { pending: 0 }, items } });
      return route.fulfill({ json: {} });
    });
    await page.setViewportSize({ width: 390, height: 1100 });
    await page.goto("/health");
    const card = page.getByTestId("workout-trend-running");
    await expect(card).toContainText("Running");
    await expect(card).toContainText("This week");
    await expect(card).toContainText("/km");
    await expect(page.getByTestId("workout-trend-hiking")).toHaveCount(0);
    await expect(page.getByText("Show all")).toBeVisible();
    await page.screenshot({ path: `test-results/workout-trends-${theme.toLowerCase()}.png` });
  });
}

test("the plan page shows the trend for workouts linked to its activities", async ({ page, request }) => {
  await request.post(`${API}/__reset`);
  await request.patch(`${API}/users/user`, {
    headers: { Authorization: "Bearer local-e2e-token" },
    data: { themeMode: "DARK" },
  });
  // Runs logged to the plan's "run" activity; the hike belongs to no plan.
  const linked = items.map((item) =>
    item.resolved.linkedActivity.title === "running"
      ? { ...item, resolved: { ...item.resolved, activityEntryId: "entry-run" } }
      : item,
  );
  await page.route("**/health/apple/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith("/status"))
      return route.fulfill({ json: { connected: true, importStats: { workoutCount: 8 } } });
    if (pathname.endsWith("reconciliation-preview"))
      return route.fulfill({ json: { summary: { pending: 0 }, items: linked } });
    return route.fulfill({ json: {} });
  });
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/plan/fitness");
  const section = page.getByTestId("plan-workout-trends");
  await expect(section.getByTestId("workout-trend-running")).toContainText("/km");
  await expect(section.getByTestId("workout-trend-hiking")).toHaveCount(0);
  await section.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/plan-workout-trends-dark.png" });
});
