import { mkdirSync } from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
const API = `http://127.0.0.1:${process.env.E2E_API_PORT || "4317"}`;
const headers = { Authorization: "Bearer local-e2e-token" };
const output = path.resolve("../../../output/coach-showcase");
mkdirSync(output, { recursive: true });

async function capture(page: Page, name: string) {
  await page.waitForTimeout(700);
  // Hide Expo's dev badge, which is not part of the app.
  await page.evaluate(() => {
    for (const el of document.querySelectorAll<HTMLElement>("body *")) {
      const box = el.getBoundingClientRect();
      if (getComputedStyle(el).position === "fixed" && box.width < 120 && box.height < 120 && box.left < 80 && box.bottom > innerHeight - 120) el.style.display = "none";
    }
  });
  await page.screenshot({ path: path.join(output, `${name}.png`) });
}

for (const theme of ["DARK", "LIGHT"]) {
  test(`a lighter week reads as the coach's note and a big 6 → 5 (${theme})`, async ({ page, request }) => {
    await request.post(`${API}/__reset`);
    await request.patch(`${API}/users/user`, { headers, data: { themeMode: theme, themeBaseColor: "AMBER" } });
    const state = await (await request.get(`${API}/__state`)).json();
    const planId = state.plans[0].id;
    await request.post(`${API}/__coaching-monitoring`, {
      headers,
      data: {
        planOverrides: [{ id: planId, goal: "Play a bit of chess every day", emoji: "♟️", outlineType: "TIMES_PER_WEEK", timesPerWeek: 6 }],
        messages: [{
          id: "coach-lighter", chatId: "coach-main", planId, planIds: [planId], role: "COACH", status: "SENT",
          content: "Two weeks short of six. Want a target that holds?", createdAt: new Date().toISOString(),
          planProposals: [{
            planId, planGoal: "Play a bit of chess every day", planEmoji: "♟️",
            description: "Six didn't hold the last two weeks. Five keeps the habit without the end-of-week scramble.",
            patch: { plan: { timesPerWeek: 5 } }, status: null,
          }],
        }],
      },
    });
    await page.goto("/chat/coach-main");
    await page.getByRole("button", { name: /^Review Play a bit of chess/ }).click();
    await expect(page.getByTestId("coach-note")).toBeVisible();
    const hero = page.getByTestId("change-hero");
    await expect(hero).toContainText("6");
    await expect(hero).toContainText("5");
    await expect(hero).toContainText("sessions a week");
    // The number is the change; the list below doesn't repeat it.
    await expect(page.getByText("5 times per week")).toHaveCount(0);
    await capture(page, `review-changes-${theme.toLowerCase()}`);

    await page.getByRole("button", { name: "Accept Changes", exact: true }).click();
    await expect.poll(async () => (await (await request.get(`${API}/__state`)).json()).plans[0].timesPerWeek).toBe(5);
  });
}
