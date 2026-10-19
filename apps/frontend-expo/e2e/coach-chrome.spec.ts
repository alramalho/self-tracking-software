import { test, expect } from "@playwright/test";
const API = process.env.E2E_API_URL ?? "http://127.0.0.1:4317";

const longReply =
  "No structural change needed this week. Oct 6 and Oct 8 came in near 5:45–6:10/km with heart rates around 160–170, harder than the 6:30–7:00 easy band; banking that intensity now is what eats into the long-run build, so keep every non-quality run **conversational**.\n\nSleep was also light on the nights we have data for (scores of 59 and 69 on Oct 14–15), so protect the night before your longest run.\n\nWhich day this week is the long run going on the calendar?";

const attentionItem = {
  dedupeKey: "fitness-ending",
  kind: "SPECIFIC_SCHEDULE_ENDING",
  title: "Schedule ending",
  message: "Your plan has no sessions after this week.",
  facts: [],
  primaryAction: {
    prompt:
      "Review the plan notes and current progress, then propose the next useful sessions or ask one question if you need direction.",
  },
};

test.beforeEach(async ({ request }) => {
  await request.post(`${API}/__reset`);
});

for (const theme of ["DARK", "LIGHT"])
  test(`coach thread has a floating attention island and a two-row composer in ${theme}`, async ({
    page,
    request,
  }) => {
    await request.patch(`${API}/users/user`, {
      headers: { Authorization: "Bearer local-e2e-token" },
      data: { themeMode: theme },
    });
    await page.route("**/ai/coach/attention", (route) =>
      route.fulfill({ json: { attentionItems: [attentionItem] } }),
    );
    await page.route("**/chats/coach-main/messages?**", async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      body.messages.push(
        {
          id: "design-user",
          chatId: "coach-main",
          role: "USER",
          content: "How should this week look?",
          createdAt: new Date().toISOString(),
        },
        {
          id: "design-coach",
          chatId: "coach-main",
          role: "COACH",
          status: "SENT",
          content: longReply,
          createdAt: new Date().toISOString(),
        },
      );
      await route.fulfill({ response, json: body });
    });
    await page.goto("/chat/coach-main");
    await expect(
      page.getByText("Which day this week is the long run", { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /1 plan update needs attention/ }),
    ).toBeVisible();
    // The newest line rests above the floating composer, not behind it.
    await expect
      .poll(async () => {
        const last = await page
          .getByText("Which day this week is the long run", { exact: false })
          .boundingBox();
        const composer = await page
          .getByLabel("Message", { exact: true })
          .boundingBox();
        return !!last && !!composer && last.y + last.height <= composer.y;
      })
      .toBeTruthy();
    await page.screenshot({ path: `test-results/coach-chrome-${theme}.png` });
    await page
      .getByRole("button", { name: /1 plan update needs attention/ })
      .click();
    await expect(page.getByLabel("Message", { exact: true })).toHaveValue(
      attentionItem.primaryAction.prompt,
    );
    await expect(
      page.getByRole("button", { name: /1 plan update needs attention/ }),
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Messages: / })).toHaveCount(0);
    await page.screenshot({
      path: `test-results/coach-chrome-${theme}-draft.png`,
    });
  });
