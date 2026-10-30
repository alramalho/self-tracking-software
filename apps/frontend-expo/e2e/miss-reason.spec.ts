import { test, expect } from "@playwright/test";
const API = `http://127.0.0.1:${process.env.E2E_API_PORT || "4317"}`;
const headers = { Authorization: "Bearer local-e2e-token" };
const readingRow = /^Read before bed (is at risk this week|missed last week)\./;

for (const theme of ["DARK", "LIGHT"])
  test(`a missed week asks what got in the way, then this week's days, in ${theme}`, async ({ page, request }) => {
    await request.post(`${API}/__reset`);
    await request.patch(`${API}/users/user`, { headers, data: { themeMode: theme } });
    await request.post(`${API}/__plan-nudges`, { headers, data: {} });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/coach");

    await page.getByRole("button", { name: readingRow }).click();
    await expect(page.getByText("What got in the way?", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Open plan", exact: true })).toHaveCount(0);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `test-results/miss-reason-sheet-${theme}.png` });

    // A reason moves to this week's days inside the drawer; nothing is sent in chat.
    await page.getByRole("button", { name: "Travelling", exact: true }).click();
    await expect(page.getByText("This week", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Back", exact: true })).toBeVisible();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `test-results/miss-reason-days-${theme}.png` });
    await page.getByTestId("missed-week-save").click();
    await expect(page.getByText("This week", { exact: true })).toHaveCount(0);
    const state = await (await request.get(`${API}/__state`)).json();
    expect(state.requests.filter((r: any) => r.method === "POST" && r.path.endsWith("/messages/stream"))).toHaveLength(0);
    const answers = state.requests.filter((r: any) => r.method === "POST" && r.path === "/follow-through/plans/reading/missed-week");
    expect(answers).toHaveLength(1);
    expect(answers[0].body).toMatchObject({ reason: "travel" });
    expect(answers[0].body.days.length).toBeGreaterThan(0);

    // Asked once: the answered week leaves the Coach tab.
    await page.goto("/coach");
    await expect(page.getByTestId("coach-messages")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Read before bed missed last week\./ })).toHaveCount(0);
    expect(errors).toEqual([]);
  });

test("something else opens the chat with the sentence started, unsent", async ({ page, request }) => {
  await request.post(`${API}/__reset`);
  await request.post(`${API}/__plan-nudges`, { headers, data: {} });
  await page.goto("/coach");
  await page.getByRole("button", { name: readingRow }).click();
  await page.getByRole("button", { name: "Something else", exact: true }).click();
  await expect(page.getByTestId("chat-message-input")).toHaveValue('I missed "Read before bed" last week because ');
  await page.waitForTimeout(1000);
  const state = await (await request.get(`${API}/__state`)).json();
  expect(state.requests.filter((r: any) => r.method === "POST" && r.path.endsWith("/messages/stream"))).toHaveLength(0);
});

test("a coach note keeps its own button and the plan stays one tap away", async ({ page, request }) => {
  await request.post(`${API}/__reset`);
  await request.post(`${API}/__plan-nudges`, { headers, data: {} });
  await page.goto("/coach");
  await page.getByRole("button", { name: /^Practice guitar has gone quiet\./ }).click();
  await expect(page.getByRole("button", { name: "Open coach message", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open plan", exact: true })).toBeVisible();
  await expect(page.getByText("What got in the way?", { exact: true })).toHaveCount(0);
});

// One short twice in a row: the drawer names the streak cost in one line (the iPhone drawer
// keeps to one fact; the coach explains the rest when you answer).
for (const theme of ["DARK", "LIGHT"])
  test(`one short twice in a row shows the streak cost in ${theme}`, async ({ page, request }) => {
    await request.post(`${API}/__reset`);
    await request.patch(`${API}/users/user`, { headers, data: { themeMode: theme, coachPersonality: "STRATEGIST" } });
    await request.post(`${API}/__plan-nudges`, { headers, data: {} });
    await page.route(/\/plans\/?(\?.*)?$/, async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      const plans = await (await route.fetch()).json();
      const plan = plans.find((p: any) => p.id === "stretch");
      plan.goal = "train 4 times a week";
      plan.timesPerWeek = 4;
      plan.progress.achievement = {
        streak: 7,
        missedLastWeek: { streakBefore: 8, streakAfter: 7, inARow: 1, done: 3, target: 4, oneShortAgain: true },
      };
      // Nothing planned yet this week, so the plan reads as last week's miss and not as at risk.
      plan.progress.weeks = [{ ...plan.progress.weeks[0], startDate: new Date().toISOString(), plannedActivities: 0 }];
      await route.fulfill({ json: plans });
    });
    await page.goto("/coach");
    await page.getByRole("button", { name: /^train 4 times a week missed last week\./ }).click();
    await expect(page.getByRole("heading", { name: "train 4 times a week missed last week", exact: true })).toBeVisible();
    await expect(page.getByText("Streak 8 → 7", { exact: true }).last()).toBeVisible();
    await expect(page.getByText("What got in the way?", { exact: true })).toBeVisible();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `test-results/missed-week-${theme}.png` });
  });
