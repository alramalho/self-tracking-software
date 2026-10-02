import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const API = `http://127.0.0.1:${process.env.E2E_API_PORT || "4317"}`;
const headers = { Authorization: "Bearer local-e2e-token" };
const output = path.resolve("../../docs/reviews/streak-explainer");
const day = 86_400_000;

// The owner's real weeks: complete, one short (held), one short again (missed).
function weeks() {
  const sunday = new Date();
  sunday.setHours(12, 0, 0, 0);
  sunday.setDate(sunday.getDate() - sunday.getDay());
  const week = (ago: number, done: number, outcome?: string) => ({
    startDate: new Date(sunday.getTime() - ago * 7 * day).toISOString(),
    isCompleted: done >= 4,
    doneCount: done,
    targetCount: 4,
    plannedActivities: 4,
    completedActivities: [],
    ...(outcome ? { outcome } : {}),
  });
  return [
    week(5, 4, "complete"),
    week(4, 2, "missed"),
    week(3, 4, "complete"),
    week(2, 3, "held"),
    week(1, 3, "missed"),
    week(0, 1),
  ];
}

for (const theme of ["LIGHT", "DARK"]) {
  test(`tapping the flame under the grid explains the streak in ${theme}`, async ({ page, request }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await request.post(`${API}/__reset`);
    await request.patch(`${API}/users/user`, { headers, data: { themeMode: theme } });
    await page.route((url) => url.origin === API && url.pathname === "/plans", async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      const plans = await (await route.fetch()).json();
      Object.assign(plans[0], {
        goal: "train 4 times a week",
        outlineType: "TIMES_PER_WEEK",
        timesPerWeek: 4,
        progress: {
          weeks: weeks(),
          achievement: { streak: 7, missedLastWeek: { streakBefore: 8, streakAfter: 7, inARow: 1, done: 3, target: 4, oneShortAgain: true } },
          habitAchievement: { isAchieved: false, progressValue: 4, maxValue: 4 },
          lifestyleAchievement: { isAchieved: false, progressValue: 7, maxValue: 9 },
        },
      });
      await route.fulfill({ json: plans });
    });
    // The grid starts at the first log, so the plan needs one from six weeks ago.
    await page.route((url) => url.origin === API && url.pathname === "/activities/activity-entries", async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      const entries = await (await route.fetch()).json();
      const old = new Date(Date.now() - 40 * day).toISOString();
      await route.fulfill({ json: [...entries, { ...entries[0], id: "old-entry", datetime: old, createdAt: old }] });
    });
    await page.goto("/plans");
    const grid = page.getByTestId("plans-screen").getByTestId("activity-heatmap").filter({ visible: true }).first();
    await expect(grid).toBeVisible();
    const held = grid.getByRole("button", { name: "One session short, streak held. How streaks work" });
    await expect(held).toHaveCount(1);
    mkdirSync(output, { recursive: true });
    await grid.scrollIntoViewIfNeeded();
    await page.waitForTimeout(900); // the grid finishes fading in
    await page.screenshot({ path: path.join(output, `grid-${theme}.png`) });

    await held.click();
    const drawer = page.getByTestId("streak-explainer");
    await expect(drawer.getByRole("heading", { name: "🔥 7 week streak" })).toBeVisible();
    await expect(drawer.getByTestId("streak-example-complete")).toContainText("Week completed");
    await expect(drawer.getByTestId("streak-example-complete")).toContainText("+1");
    await expect(drawer.getByTestId("streak-example-held")).toContainText("not two weeks in a row");
    await expect(drawer.getByTestId("streak-example-missed")).toContainText("−1");
    // The plan's own weeks, oldest first: the second one-short week is the one that cost a week.
    await expect(drawer.getByTestId("streak-recent-weeks")).toContainText(/4\/4.*2\/4.*4\/4.*3\/4.*3\/4/s);
    await expect(drawer.getByText("4 weeks make it a Habit, 9 a Lifestyle.")).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(output, `explainer-${theme}.png`) });

    await drawer.getByRole("button", { name: "Close", exact: true }).click();
    await expect(drawer).toHaveCount(0);
    // A completed week's flame opens the same drawer.
    await grid.getByRole("button", { name: "Week completed. How streaks work" }).first().click();
    await expect(drawer).toBeVisible();
    expect(errors).toEqual([]);
  });
}
