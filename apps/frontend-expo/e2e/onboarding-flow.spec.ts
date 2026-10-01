import { test, expect, type Page } from "@playwright/test";
import { enterWelcomeAge } from "./onboarding-welcome";
const API = `http://127.0.0.1:${process.env.E2E_API_PORT || "4317"}`;
const headers = { Authorization: "Bearer local-e2e-token" };
const next = (page: Page, name = "Continue") => page.getByRole("button", { name, exact: true }).click();
const progress = (page: Page) => page.getByRole("progressbar", { name: "Onboarding progress" });
// The designed flow (outcome and consistency screens) is covered in outcome-onboarding.spec.ts.
// This file keeps the gates, resume, retry and checkout behaviour that sit around it.
async function openOnboarding(page: Page, url: string) {
  await page.goto(url);
  await page.getByRole("button", { name: "I'm ready!" }).waitFor({ timeout: 3000 }).then(async () => {
    await enterWelcomeAge(page);
    await next(page);
  }).catch(() => {});
}
async function answerText(page: Page, value: string) {
  await page.getByRole("textbox", { name: "Your answer" }).fill(value);
  await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeEnabled();
  await next(page);
}
async function throughMotivation(page: Page, goal = "Run my first half marathon") {
  await answerText(page, goal);
  await expect(page.getByRole("heading", { name: "How much do you run now?" })).toBeVisible();
  await answerText(page, "Twice a week, about 5 km each. My easy 5 km takes 35–37 minutes.");
  await expect(page.getByRole("heading", { name: "Why does it matter?" })).toBeVisible();
  await page.getByRole("button", { name: "Skip this question" }).click();
  await expect(page.getByRole("heading", { name: "Do you have a finish time in mind?" })).toBeVisible();
}
async function toPaywall(page: Page) {
  await throughMotivation(page);
  await page.getByRole("button", { name: "No target in mind" }).click();
  await expect(page.getByRole("heading", { name: "How many days would you prefer?" })).toBeVisible();
  await next(page, "Ask my coach");
  await page.getByTestId("route-focused").click();
  await next(page);
  for (let i = 0; i < 3; i++) await next(page);
  await page.getByRole("button", { name: "Just me" }).click();
}
// One decision on one screen: the link under the table creates the plan directly, with no second sheet.
const trackForFree = async (page: Page) => {
  await page.getByRole("button", { name: /^Continue without / }).click();
};

test("a paid member meets the coach straight after choosing a route, with no coaching question", async ({ page, request }) => {
  await request.post(`${API}/__reset`);
  await openOnboarding(page, "/onboarding");
  await toPaywall(page);
  await expect(page.getByText(/coach this plan/i)).toHaveCount(0);
  await page.getByRole("button", { name: "Start with my coach" }).click();
  await expect(page).toHaveURL(/plans\?selectedPlan=/);
  const state = await (await request.get(`${API}/__state`)).json();
  const finish = state.requests.filter((r: any) => r.path.endsWith("/finish")).at(-1);
  expect(finish.body.preferences).toMatchObject({ coaching: true, weeklyReview: true, checkIn: true });
  expect(finish.body.draft.design).toMatchObject({ orientation: "OUTCOME", selected: "focused" });
  expect(finish.body.draft.coaching.role).toBe("training");
  // The two reviewed weeks become the plan's sessions.
  const plan = state.plans.at(-1);
  expect(plan.outlineType).toBe("SPECIFIC");
  expect(plan.sessions.length).toBeGreaterThanOrEqual(8);
  expect(plan.sessions[0].targets.pace.basis).toBe("USER_REPORTED_EASY_PACE");
});

test("nonsense is blocked at the goal and the coach reads a good goal before asking anything", async ({ page, request }) => {
  await request.post(`${API}/__reset`);
  await openOnboarding(page, "/onboarding?preview=1");
  await page.getByRole("textbox", { name: "Your answer" }).fill("asdf");
  await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeDisabled();
  await expect(page.getByTestId("goal-guidance")).toContainText("Name one concrete outcome");
  await page.getByRole("textbox", { name: "Your answer" }).fill("Run my first half marathon");
  await next(page);
  await expect(page.getByRole("heading", { name: "How much do you run now?" })).toBeVisible();
  const state = await (await request.get(`${API}/__state`)).json();
  expect(state.requests.filter((r: any) => r.path.endsWith("/design/classify"))).toHaveLength(1);
});

test("going back keeps what was typed, and the baseline can't be skipped for an outcome", async ({ page, request }) => {
  await request.post(`${API}/__reset`);
  await openOnboarding(page, "/onboarding?preview=1");
  await answerText(page, "Run my first half marathon");
  await expect(page.getByRole("heading", { name: "How much do you run now?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Skip this question" })).toHaveCount(0);
  await answerText(page, "I currently run two easy 3 km runs a week");
  await expect(page.getByRole("heading", { name: "Why does it matter?" })).toBeVisible();
  await page.getByRole("button", { name: "Previous question" }).click();
  await expect(page.getByRole("textbox", { name: "Your answer" })).toHaveValue("I currently run two easy 3 km runs a week");
});

test("a failed goal read can be retried and start over resets the flow", async ({ page, request }) => {
  await request.post(`${API}/__reset`);
  await openOnboarding(page, "/onboarding?preview=1");
  await page.getByRole("textbox", { name: "Your answer" }).fill("Run my first half marathon");
  await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeEnabled();
  await request.post(`${API}/__fail`, { data: { path: "/follow-through/onboarding/design/classify" } });
  await next(page);
  await expect(page.getByText("Simulated network failure. Please try again.")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Your answer" })).toHaveValue("Run my first half marathon");
  await next(page);
  await expect(page.getByRole("heading", { name: "How much do you run now?" })).toBeVisible();
  await page.getByRole("button", { name: "Previous question" }).click();
  await page.getByRole("button", { name: "Start over", exact: true }).click();
  await expect(progress(page)).toHaveAttribute("aria-valuenow", "1");
  await expect(page.getByRole("textbox", { name: "Your answer" })).toHaveValue("");
});

test("closing and reopening returns to the chosen plan, not the start", async ({ page, request }) => {
  await request.post(`${API}/__reset`);
  await openOnboarding(page, "/onboarding");
  await throughMotivation(page);
  await page.getByRole("button", { name: "No target in mind" }).click();
  await expect(page.getByRole("heading", { name: "How many days would you prefer?" })).toBeVisible();
  await next(page, "Ask my coach");
  await page.getByTestId("route-steady").click();
  await expect(page.getByTestId("two-weeks")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("two-weeks")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Helly · 2–3 days per week" })).toBeVisible();
});

test("resume retains the plan and a delayed upgrade unlocks and continues exactly once", async ({ page, request }) => {
  await request.post(`${API}/__reset`);
  await request.patch(`${API}/users/user`, { headers, data: { planType: "FREE" } });
  await openOnboarding(page, "/onboarding");
  await toPaywall(page);
  await page.getByRole("button", { name: "Start my 7 free days" }).click();
  await expect(page.getByRole("button", { name: "Check subscription again" })).toBeVisible();
  let state = await (await request.get(`${API}/__state`)).json();
  expect(state.requests.filter((r: any) => r.path.endsWith("/finish"))).toHaveLength(0);
  await page.reload();
  await expect(page.getByRole("button", { name: "Check subscription again" })).toBeVisible();
  await request.patch(`${API}/users/user`, { headers, data: { planType: "PLUS" } });
  await expect(page).toHaveURL(/plans\?selectedPlan=/);
  state = await (await request.get(`${API}/__state`)).json();
  expect(state.requests.filter((r: any) => r.path.endsWith("/finish"))).toHaveLength(1);
  expect(state.requests.find((r: any) => r.path.endsWith("/finish")).body.preferences.coaching).toBe(true);
});

test("free tracking keeps the designed plan, without a trial or checkout", async ({ page, request }) => {
  await request.post(`${API}/__reset`);
  await request.patch(`${API}/users/user`, { headers, data: { planType: "FREE" } });
  await openOnboarding(page, "/onboarding");
  await toPaywall(page);
  await expect(page.getByTestId("coaching-paywall")).toBeVisible();
  // What stays and what the coach adds, side by side. The coach is the one whose route was chosen.
  const compare = page.getByTestId("paywall-compare");
  await expect(compare).toContainText("On your own");
  await expect(compare).toContainText("With Oli");
  await expect(compare).toContainText("Two weeks, pace, targets");
  await expect(compare).toContainText("Next weeks planned as you go");
  await expect(compare.getByLabel("Not included")).toHaveCount(4);
  await expect(page.getByText("Your plan is ready either way")).toHaveCount(0);
  // Quarterly (7 free days) is preselected; weekly has no trial.
  await expect(page.getByRole("button", { name: "Start my 7 free days" })).toBeVisible();
  await page.getByRole("radio", { name: /^Weekly/ }).click();
  await expect(page.getByRole("button", { name: "Start coaching", exact: true })).toBeVisible();
  for (const link of ["Terms", "Restore", "Privacy"]) await expect(page.getByRole("link", { name: link, exact: true })).toBeVisible();
  await request.post(`${API}/__fail`, { data: { path: "/follow-through/onboarding/finish" } });
  await trackForFree(page);
  await expect(page.getByText("Simulated network failure. Please try again.")).toBeVisible();
  await trackForFree(page);
  await expect(page).toHaveURL(/plans\?selectedPlan=/);
  const state = await (await request.get(`${API}/__state`)).json();
  const finish = state.requests.filter((r: any) => r.path.endsWith("/finish")).at(-1);
  expect(finish.body.preferences.coaching).toBe(false);
  expect(finish.body.draft.wantsCoaching).toBe(false);
  expect(finish.body.draft.design.selected).toBe("focused");
});

test("back from the paywall returns to the circle question", async ({ page, request }) => {
  await request.post(`${API}/__reset`);
  await request.patch(`${API}/users/user`, { headers, data: { planType: "FREE" } });
  await openOnboarding(page, "/onboarding");
  await toPaywall(page);
  await expect(page.getByTestId("coaching-paywall")).toBeVisible();
  await page.getByRole("button", { name: "Previous question" }).click();
  await expect(page.getByRole("heading", { name: "Do it with a group?" })).toBeVisible();
});

test("creating a plan inside the app skips the welcome and starts the baseline from the person's logs", async ({ page, request }) => {
  await request.post(`${API}/__reset`);
  await page.goto("/create-plan?voiceGoal=Run%20my%20first%20half%20marathon");
  await expect(page.getByRole("button", { name: "I'm ready!" })).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Your answer" })).toHaveValue("Run my first half marathon");
  await next(page);
  await expect(page.getByRole("heading", { name: "How much do you run now?" })).toBeVisible();
  const box = page.getByRole("textbox", { name: "Your answer" });
  await expect(box).toHaveValue(/9 sessions in the last 4 weeks/);
  await next(page);
  await expect(page.getByRole("heading", { name: "Why does it matter?" })).toBeVisible();
  await page.getByRole("button", { name: "Skip this question" }).click();
  await page.getByRole("button", { name: "No target in mind" }).click();
  await next(page, "Ask my coach");
  await expect(page.getByTestId("route-steady")).toBeVisible();
  const state = await (await request.get(`${API}/__state`)).json();
  const ask = state.requests.find((r: any) => r.path.endsWith("/design/options"));
  // The text carries the numbers from their logs, so the coach can ground the plan in them.
  expect(ask.body.baseline).toContain("9 sessions in the last 4 weeks");
});

test("an existing plan can be designed with the coach: logs baseline, days check, two routes, applied to that plan", async ({ page, request }) => {
  await request.post(`${API}/__reset`);
  const plans = await (await request.get(`${API}/plans`, { headers })).json();
  const plan = (Array.isArray(plans) ? plans : plans.plans)[0];
  await page.goto(`/plan/${plan.id}`);
  await page.getByText("Plan this with my coach").click();
  await expect(page.getByTestId("redesign-baseline")).toHaveValue(/9 sessions in the last 4 weeks/);
  await expect(page.getByText("From your logs.")).toBeVisible();
  await next(page);
  await page.getByRole("button", { name: "No target in mind" }).click();
  await expect(page.getByRole("heading", { name: "How many days would you prefer?" })).toBeVisible();
  await next(page, "Ask my coach");
  await page.getByTestId("route-steady").click();
  await expect(page.getByTestId("two-weeks")).toBeVisible();
  await next(page);
  await expect(page).toHaveURL(new RegExp(`/plan/${plan.id}`));
  const state = await (await request.get(`${API}/__state`)).json();
  const applied = state.requests.find((r: any) => r.path === `/follow-through/plans/${plan.id}/redesign`);
  expect(applied.body.design).toMatchObject({ orientation: "OUTCOME", selected: "steady" });
  expect(applied.body.design.baseline.text).toContain("9 sessions in the last 4 weeks");
  expect(applied.body.design.baseline.measurements.length).toBeGreaterThan(0);
});
