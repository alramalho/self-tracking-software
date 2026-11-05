import { test, expect } from "@playwright/test";
const API = `http://127.0.0.1:${process.env.E2E_API_PORT || "4317"}`;
const headers = { Authorization: "Bearer local-e2e-token" };
const readingRow = /^Read before bed (is at risk this week|missed last week)\./;

const sent = async (request: any) =>
  ((await (await request.get(`${API}/__state`)).json()).requests as any[]).filter(
    (r) => r.method === "POST" && r.path.endsWith("/messages/stream"),
  );

for (const theme of ["DARK", "LIGHT"])
  test(`travelling: the coach asks when you're back, then goes quiet until then, in ${theme}`, async ({ page, request }) => {
    await request.post(`${API}/__reset`);
    await request.patch(`${API}/users/user`, { headers, data: { themeMode: theme } });
    await request.post(`${API}/__plan-nudges`, { headers, data: {} });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/coach");

    await page.getByRole("button", { name: readingRow }).click();
    await expect(page.getByText("What got in the way?", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Talk to Helly", exact: true })).toBeVisible();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `test-results/talk-drawer-${theme}.png` });

    await page.getByRole("button", { name: "Travelling", exact: true }).click();
    await expect(page.getByTestId("talk-say")).toHaveText("When are you back?");
    await page.getByTestId("talk-answer").fill("back sunday night");
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `test-results/talk-question-${theme}.png` });
    await page.getByRole("button", { name: "Send", exact: true }).click();

    await expect(page.getByTestId("talk-say")).toHaveText("Quiet until you're back.");
    await expect(page.getByRole("button", { name: "Keep nudging me", exact: true })).toBeVisible();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `test-results/talk-reply-${theme}.png` });
    const talks = ((await (await request.get(`${API}/__state`)).json()).requests as any[]).filter((r) => r.path === "/follow-through/plans/reading/talk");
    expect(talks.map((r) => r.body)).toEqual([
      { reason: "travel", turns: [], notSure: false },
      { reason: "travel", turns: [{ say: "When are you back?", answer: "back sunday night" }], notSure: false },
    ]);
    expect(await sent(request)).toHaveLength(0);

    // Quiet: the plan's alert leaves the Coach tab until the return day.
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.goto("/coach");
    await expect(page.getByTestId("coach-messages")).toBeVisible();
    await expect(page.getByRole("button", { name: readingRow })).toHaveCount(0);
    expect(errors).toEqual([]);
  });

test("not sure yet ends the conversation and asks again later", async ({ page, request }) => {
  await request.post(`${API}/__reset`);
  await request.post(`${API}/__plan-nudges`, { headers, data: {} });
  await page.goto("/coach");
  await page.getByRole("button", { name: readingRow }).click();
  await page.getByRole("button", { name: "Travelling", exact: true }).click();
  await expect(page.getByTestId("talk-say")).toHaveText("When are you back?");
  await page.getByRole("button", { name: "Not sure yet", exact: true }).click();
  await expect(page.getByTestId("talk-detail")).toHaveText("I'll ask again in three days.");
  await expect(page.getByRole("button", { name: "Keep nudging me", exact: true })).toHaveCount(0);
});

test("something else starts with the person's own words, and nothing is sent in chat", async ({ page, request }) => {
  await request.post(`${API}/__reset`);
  await request.post(`${API}/__plan-nudges`, { headers, data: {} });
  await page.goto("/coach");
  await page.getByRole("button", { name: readingRow }).click();
  await page.getByRole("button", { name: "Something else", exact: true }).click();
  await expect(page.getByTestId("talk-say")).toHaveText("What got in the way?");
  await page.getByTestId("talk-answer").fill("Exams all week");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByTestId("talk-say")).toHaveText("Got it.");
  await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeVisible();
  expect(await sent(request)).toHaveLength(0);
});

test("a plan that went quiet also asks what got in the way", async ({ page, request }) => {
  await request.post(`${API}/__reset`);
  await request.post(`${API}/__plan-nudges`, { headers, data: {} });
  await page.goto("/coach");
  await page.getByRole("button", { name: /^Practice guitar has gone quiet\./ }).click();
  await expect(page.getByText("What got in the way?", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open plan", exact: true })).toBeVisible();
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
