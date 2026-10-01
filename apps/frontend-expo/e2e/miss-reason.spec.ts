import { test, expect } from "@playwright/test";
const API = `http://127.0.0.1:${process.env.E2E_API_PORT || "4317"}`;
const headers = { Authorization: "Bearer local-e2e-token" };
const readingCard = /^Read before bed, (this week is at risk|missed last week)/;

for (const theme of ["DARK", "LIGHT"])
  test(`a missed week asks what got in the way and tells the coach in ${theme}`, async ({ page, request }) => {
    await request.post(`${API}/__reset`);
    await request.patch(`${API}/users/user`, { headers, data: { themeMode: theme } });
    await request.post(`${API}/__plan-nudges`, { headers, data: {} });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");

    await page.getByRole("button", { name: readingCard }).click();
    await expect(page.getByText("What got in the way?", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Open plan", exact: true })).toHaveCount(0);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `test-results/miss-reason-sheet-${theme}.png` });

    // One tap sends the reason, with the plan attached, and the coach answers.
    await page.getByRole("button", { name: "Travelling", exact: true }).click();
    await expect(page).toHaveURL(/\/chat\//);
    const sent = 'I missed "Read before bed" last week. I was travelling. Can you help me make this week work?';
    await expect(page.getByText(sent, { exact: true })).toBeVisible();
    await expect(page.getByText("That sounds good. Keep the next run comfortable.", { exact: true })).toBeVisible();
    await page.screenshot({ path: `test-results/miss-reason-chat-${theme}.png` });
    const state = await (await request.get(`${API}/__state`)).json();
    const posts = state.requests.filter((r: any) => r.method === "POST" && /^\/chats\/[^/]+\/messages\/stream$/.test(r.path));
    expect(posts).toHaveLength(1);
    expect(posts[0].body).toMatchObject({ planId: "reading", message: sent });

    // Asked once: the sheet now offers the conversation instead of the question.
    await page.goto("/");
    await page.getByRole("button", { name: readingCard }).click();
    await expect(page.getByRole("button", { name: /^Talk to / })).toBeVisible();
    await expect(page.getByText("What got in the way?", { exact: true })).toHaveCount(0);
    expect(errors).toEqual([]);
  });

test("something else opens the chat with the sentence started, unsent", async ({ page, request }) => {
  await request.post(`${API}/__reset`);
  await request.post(`${API}/__plan-nudges`, { headers, data: {} });
  await page.goto("/");
  await page.getByRole("button", { name: readingCard }).click();
  await page.getByRole("button", { name: "Something else", exact: true }).click();
  await expect(page.getByTestId("chat-message-input")).toHaveValue('I missed "Read before bed" last week because ');
  await page.waitForTimeout(1000);
  const state = await (await request.get(`${API}/__state`)).json();
  expect(state.requests.filter((r: any) => r.method === "POST" && r.path.endsWith("/messages/stream"))).toHaveLength(0);
});

test("a coach note keeps its own button and the plan stays one tap away", async ({ page, request }) => {
  await request.post(`${API}/__reset`);
  await request.post(`${API}/__plan-nudges`, { headers, data: {} });
  await page.goto("/");
  await page.getByRole("button", { name: /^Practice guitar, gone quiet/ }).click();
  await expect(page.getByRole("button", { name: "Open coach message", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open plan", exact: true })).toBeVisible();
  await expect(page.getByText("What got in the way?", { exact: true })).toHaveCount(0);
});
