import { test, expect } from "@playwright/test";
const API = "http://127.0.0.1:4317";
test.beforeEach(async ({ request }) => {
  await request.post(`${API}/__reset`);
});
for (const mode of ["dark", "light"])
  test(`home messages and coach contract in ${mode}`, async ({
    page,
    request,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await request.patch(`${API}/users/user`, {
      headers: { Authorization: "Bearer local-e2e-token" },
      data: { themeMode: mode.toUpperCase() },
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Messages", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Sam", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Message Helly, AI Coach" }).click();
    await expect(
      page.getByText("How did your run feel?", { exact: false }),
    ).toBeVisible();
    await page
      .getByLabel("Message", { exact: true })
      .fill("A comfortable run today");
    await page
      .getByRole("button", { name: "Send message", exact: true })
      .click();
    await expect(page.getByText("Thinking…", { exact: true })).toBeVisible();
    await expect(
      page.getByText("That sounds good. Keep the next run comfortable.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByLabel("Message", { exact: true })).toHaveValue("");
    await page.screenshot({ path: `test-results/coach-${mode}.png` });
    const state = await (await request.get(`${API}/__state`)).json();
    expect(
      state.requests.some(
        (r: any) =>
          r.path === "/chats/coach-main/messages/stream" &&
          r.body.coachVersion === "v2" &&
          r.body.message === "A comfortable run today",
      ),
    ).toBeTruthy();
    await expect.poll(async () => {
      const latest = await (await request.get(`${API}/__state`)).json();
      return latest.requests.some((r: any) => r.path === "/chats/coach-main/messages/mark-read");
    }).toBeTruthy();
    expect(errors).toEqual([]);
  });
test("coach proposal, feedback, failed send and direct chat", async ({
  page,
  request,
}) => {
  await page.goto("/chat/coach-main");
  await page.getByRole("button", { name: /^Review Run/ }).click();
  await page.getByRole("button", { name: "Accept Log", exact: true }).click();
  await expect(page.getByRole("button", { name: "Close Review Log" })).not.toBeVisible();
  await page.getByText("How did your run feel?", { exact: false }).click();
  await page
    .getByRole("button", { name: "Good response", exact: true })
    .click();
  await request.post(`${API}/__fail`, {
    data: { path: "/chats/coach-main/messages/stream" },
  });
  await page.getByLabel("Message", { exact: true }).fill("Keep this draft");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByLabel("Message", { exact: true })).toHaveValue(
    "Keep this draft",
  );
  await expect(
    page.getByText("Simulated network failure", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    page.getByText("That sounds good. Keep the next run comfortable.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.goto("/chat/direct-sam");
  await expect(
    page.getByText("See you tomorrow", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Message", { exact: true }).fill("See you then");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByText("See you then", { exact: true })).toBeVisible();
  const state = await (await request.get(`${API}/__state`)).json();
  expect(
    state.requests.some(
      (r: any) =>
        r.path === "/ai/messages/coach-welcome/accept-activity-log-proposal" &&
        r.body.proposalIndex === 0,
    ),
  ).toBeTruthy();
  expect(
    state.requests.some(
      (r: any) =>
        r.path.endsWith("/feedback") && r.body.feedbackType === "POSITIVE",
    ),
  ).toBeTruthy();
  expect(
    state.requests.some(
      (r: any) =>
        r.path === "/chats/direct-sam/messages" &&
        r.body.message === "See you then",
    ),
  ).toBeTruthy();
});
test("coach editing, settings and new conversation preserve history", async ({
  page,
  request,
}) => {
  await page.goto("/chat/coach-main");
  await page.getByLabel("Message", { exact: true }).fill("First message");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    page.getByText("That sounds good. Keep the next run comfortable.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByText("First message", { exact: true }).click();
  await page.getByRole("button", { name: "Edit message", exact: true }).click();
  await page.getByLabel("Message", { exact: true }).fill("Edited message");
  await page
    .getByRole("button", { name: "Save edited message", exact: true })
    .click();
  await expect(page.getByText("Edited message", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Message", { exact: true })).toHaveValue("");
  await page.getByRole("button", { name: "Conversation options" }).click();
  await page
    .getByRole("button", { name: "Coach settings", exact: true })
    .click();
  await page.getByRole("button", { name: "Choose Oli", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Selected: Oli", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Reachout hour (0–23)").fill("9");
  await page.getByRole("button", { name: "Save reachout time" }).click();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Conversation options" }).click();
  await page
    .getByRole("button", { name: "New conversation", exact: true })
    .click();
  await expect(page).not.toHaveURL(/coach-main/);
  await expect(page.getByText("Edited message", { exact: true })).toBeVisible();
  const state = await (await request.get(`${API}/__state`)).json();
  expect(state.user.coachPersonality).toBe("STRATEGIST");
  expect(state.user.preferredCoachingHour).toBe(9);
  expect(
    state.requests.some(
      (r: any) =>
        r.path.endsWith("/rewrite/stream") &&
        r.body.message === "Edited message",
    ),
  ).toBeTruthy();
  expect(
    state.messages.some(
      (m: any) => m.content === "Your earlier conversation is here too.",
    ),
  ).toBeTruthy();
});
test("photo attachment is sent with the coach message", async ({
  page,
  request,
}) => {
  await page.goto("/chat/coach-main");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Attach photos" }).click();
  await (await chooser).setFiles("assets/icon.png");
  await expect(
    page.getByRole("button", { name: "Remove attachment 1" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    page.getByText("That sounds good. Keep the next run comfortable.", {
      exact: true,
    }),
  ).toBeVisible();
  const state = await (await request.get(`${API}/__state`)).json();
  const sent = state.requests.find(
    (r: any) => r.path === "/chats/coach-main/messages/stream",
  );
  expect(sent.body.message).toBe("");
  expect(sent.body.imageAttachments).toHaveLength(1);
  expect(sent.body.imageAttachments[0].url).toMatch(/^data:image\//);
});
