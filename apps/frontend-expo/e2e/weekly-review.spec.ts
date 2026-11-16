import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const API = `http://127.0.0.1:${process.env.E2E_API_PORT || "4317"}`;
const headers = { Authorization: "Bearer local-e2e-token" };
const output = path.resolve(process.env.SCREENSHOT_DIR || "../../docs/reviews/weekly-review");

test.use({ timezoneId: Intl.DateTimeFormat().resolvedOptions().timeZone });

// The owner's 16 Nov report: "Your weekly review" on Home opened the chat at a one-line question, so the
// card promised a review that wasn't there. It now opens the week it looks back on (Sunday's review covers
// the week that just ended), what the coach said, and Reply.
for (const theme of ["LIGHT", "DARK"]) {
  test(`the weekly review card opens last week and the coach's line, in ${theme}`, async ({ page, request }) => {
    await request.post(`${API}/__reset`);
    await request.post(`${API}/__home-todo`, { data: { theme } });
    const sunday = new Date();
    sunday.setDate(sunday.getDate() - sunday.getDay());
    sunday.setHours(19, 7, 0, 0);
    if (sunday > new Date()) sunday.setDate(sunday.getDate() - 7);
    const day = (offset: number) => {
      const d = new Date(sunday);
      d.setDate(d.getDate() + offset);
      d.setHours(8, 0, 0, 0);
      return d.toISOString();
    };
    const plans = (await (await request.get(`${API}/plans`, { headers })).json()) as any;
    const plan = (plans.plans ?? plans).find((p: any) => p.goal === "Run my first half marathon");
    const text = "Two of three last week. When's your first run this week?";
    await request.post(`${API}/__coaching-monitoring`, {
      headers,
      data: {
        monitoring: {
          requests: [
            { id: "review-sunday", planIds: [plan.id], kind: "review", messageId: "coach-plan-review", chatId: "coach-main", createdAt: sunday.toISOString(), requiresReply: true, text },
          ],
        },
      },
    });
    // Monday and Thursday last week, and Sunday morning: Sunday belongs to the new week.
    const activityId = plan.activities[0].id;
    const entries = [day(-6), day(-3), day(0)].map((datetime, i) => ({
      id: `review-${i}`, activityId, userId: "test-user", datetime, createdAt: datetime, quantity: 5, comments: [], reactions: [],
    }));
    await page.route("**/activities/activity-entries", async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      await route.fulfill({ json: entries });
    });

    await page.goto("/");
    const note = page.getByTestId("home-coach-note");
    await expect(note).toContainText("Your weekly review");
    await expect(note).toContainText("2 of 3 last week");
    mkdirSync(output, { recursive: true });
    await page.screenshot({ path: path.join(output, `home-card-${theme.toLowerCase()}.png`) });

    await note.click();
    const week = page.getByTestId("review-week");
    await expect(week).toBeVisible();
    await expect(week).toContainText("2 of 3");
    await expect(week.getByTestId("review-day-logged")).toHaveCount(2);
    await expect(page.getByTestId("review-coach-line")).toHaveText(text);
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(output, `drawer-${theme.toLowerCase()}.png`) });

    await page.getByTestId("review-reply").click();
    await expect(page).toHaveURL(/chat\/coach-main/);
  });
}
