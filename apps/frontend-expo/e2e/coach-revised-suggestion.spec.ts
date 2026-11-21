import { test, expect } from "@playwright/test";
const API = `http://127.0.0.1:${process.env.E2E_API_PORT || "4317"}`;
const headers = { Authorization: "Bearer local-e2e-token" };

// When the coach revises its suggestion after a reply, the old card says so and can't be accepted.
for (const theme of ["DARK", "LIGHT"]) {
  test(`a replaced suggestion reads as replaced, the new one is reviewable (${theme})`, async ({ page, request }) => {
    await request.post(`${API}/__reset`);
    await request.patch(`${API}/users/user`, { headers, data: { themeMode: theme, themeBaseColor: "AMBER" } });
    const state = await (await request.get(`${API}/__state`)).json();
    const planId = state.plans[0].id;
    const at = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
    const card = (description: string, status: string | null) => ({
      planId, planGoal: "Conversational Chinese", planEmoji: "🇨🇳", description, patch: { plan: { timesPerWeek: 3 } }, status,
    });
    await request.post(`${API}/__coaching-monitoring`, {
      headers,
      data: {
        planOverrides: [{ id: planId, goal: "Conversational Chinese", emoji: "🇨🇳", outlineType: "TIMES_PER_WEEK", timesPerWeek: 4 }],
        messages: [
          { id: "coach-old", chatId: "coach-main", planId, planIds: [planId], role: "COACH", status: "SENT", createdAt: at(4),
            content: "Next, finish the self-introduction.", planProposals: [card("Finish the self-introduction first", "replaced")] },
          { id: "user-reply", chatId: "coach-main", role: "USER", senderId: "test-user", createdAt: at(3),
            content: "I already did the self-introduction." },
          { id: "coach-new", chatId: "coach-main", planId, planIds: [planId], role: "COACH", status: "SENT", createdAt: at(2),
            content: "Updated: self-intro's done, so we start with please, sorry and excuse me.", planProposals: [card("Start with polite phrases", null)] },
        ],
      },
    });
    await page.goto("/chat/coach-main");
    await expect(page.getByText("Replaced by a newer suggestion", { exact: true })).toBeVisible();
    await expect(page.getByText("Start with polite phrases", { exact: true }).first()).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `test-results/coach-replaced-suggestion-${theme.toLowerCase()}.png` });
  });
}
