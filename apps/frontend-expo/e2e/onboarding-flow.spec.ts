import { test, expect, type Page } from "@playwright/test";
const API = "http://127.0.0.1:4317";
const headers = { Authorization: "Bearer local-e2e-token" };
async function chooseWeeklyFrequency(page: Page) {
  const value = page.getByTestId("onboarding-weekly-frequency-value");
  await expect(value).toHaveText("3");
  await expect(page.getByRole("textbox", { name: "Your answer" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByTestId("coach-validation")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue", exact: true }),
  ).toBeVisible();
}
async function answerGoal(page: Page, value: string) {
  await page.getByRole("textbox", { name: "Your answer" }).fill(value);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Where are you starting?" })).toBeVisible();
  await page.getByRole("button", { name: "Skip for now" }).click();
  await expect(page.getByRole("heading", { name: "Why does this matter to you?" })).toBeVisible();
  await page.getByRole("button", { name: "Skip for now" }).click();
  await expect(page.getByTestId("coach-validation")).toHaveCount(0);
  await expect(
    page.getByRole("progressbar", { name: "Onboarding progress" }),
  ).toHaveAttribute("aria-valuenow", "4");
}
async function continueAfterValidation(page: Page) {
  await page.getByRole("button", { name: "Continue", exact: true }).click();
}
async function reviewCoachTour(page: Page) {
  await expect(page.getByTestId("coach-tour-role")).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByTestId("coach-tour-contact")).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByTestId("coach-tour-data")).toBeVisible();
  await page.getByRole("button", { name: "Review my plan" }).click();
}
async function toPaywall(page: Page, coaching = true) {
  await answerGoal(page, "I want to write guitar songs to express myself");
  await chooseWeeklyFrequency(page);
  await continueAfterValidation(page);
  await page
    .getByRole("button", {
      name: coaching ? "Yes, coach this plan" : "No, just track it",
      exact: true,
    })
    .click();
  if (coaching) await reviewCoachTour(page);
  await expect(page.getByTestId("onboarding-plan-summary")).toContainText(
    "Guitar practice",
  );
  await page.getByRole("button", { name: "This feels right" }).click();
  await continueAfterValidation(page);
}
for (const theme of ["DARK", "LIGHT"])
  test(`coach interview preview shares four gates without account writes in ${theme}`, async ({
    page,
    request,
  }) => {
    await request.post(`${API}/__reset`);
    await request.patch(`${API}/users/user`, {
      headers,
      data: { themeMode: theme },
    });
    await page.goto("/onboarding?preview=1");
    await expect(
      page.getByRole("progressbar", { name: "Onboarding progress" }),
    ).toHaveAttribute("aria-valuenow", "1");
    await page.waitForTimeout(800);
    await page.screenshot({
      path: `test-results/interview-start-${theme}.png`,
    });
    await toPaywall(page);
    await page.waitForTimeout(600);
    await page.screenshot({
      path: `test-results/interview-paywall-${theme}.png`,
    });
    await page.getByRole("button", { name: "Preview coaching unlock" }).click();
    await expect(page.getByText("Your preview is complete")).toBeVisible();
    const state = await (await request.get(`${API}/__state`)).json();
    expect(
      state.requests.filter((r: any) => r.path.endsWith("/interview")),
    ).toHaveLength(3);
    expect(
      state.requests.find(
        (r: any) =>
          r.path.endsWith("/interview") && r.body.state.stage === "rhythm",
      )?.body.answer,
    ).toBe("3 sessions a week");
    expect(
      state.requests.filter(
        (r: any) => r.path.endsWith("/draft") || r.path.endsWith("/finish"),
      ),
    ).toHaveLength(0);
    expect(state.plans).toHaveLength(2);
  });
test("weekly picker keeps its count within 1–7 and shows flexible days in the running plan", async ({
  page,
  request,
}) => {
  await request.post(`${API}/__reset`);
  await page.goto("/onboarding?preview=1");
  await answerGoal(
    page,
    "I want to run my first half marathon under 2 hours because I love running with friends",
  );
  const value = page.getByTestId("onboarding-weekly-frequency-value");
  const decrease = page.getByRole("button", {
    name: "Decrease sessions per week",
  });
  const increase = page.getByRole("button", {
    name: "Increase sessions per week",
  });
  await expect(value).toHaveText("3");
  await decrease.click();
  await decrease.click();
  await expect(value).toHaveText("1");
  await expect(decrease).toBeDisabled();
  for (let count = 2; count <= 7; count++) await increase.click();
  await expect(value).toHaveText("7");
  await expect(increase).toBeDisabled();
  await decrease.click();
  await decrease.click();
  await expect(value).toHaveText("5");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByTestId("coach-validation")).toBeVisible();
  const state = await (await request.get(`${API}/__state`)).json();
  expect(
    state.requests.find(
      (r: any) =>
        r.path.endsWith("/interview") && r.body.state.stage === "rhythm",
    )?.body.answer,
  ).toBe("5 sessions a week");
  await continueAfterValidation(page);
  await page.getByRole("button", { name: "Yes, coach this plan" }).click();
  await reviewCoachTour(page);
  await expect(page.getByTestId("onboarding-plan-summary")).toContainText(
    "5 sessions a week · flexible days",
  );
  for (let i = 0; i < 4; i++) {
    await page.getByRole("button", { name: "Previous question" }).click();
    if (
      await page
        .getByRole("button", { name: "Yes, coach this plan" })
        .isVisible()
    )
      break;
  }
  await expect(
    page.getByRole("progressbar", { name: "Onboarding progress" }),
  ).toHaveAttribute("aria-valuenow", "5");
  await expect(
    page.getByRole("button", { name: "Yes, coach this plan" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Previous question" }).click();
  await expect(
    page.getByRole("progressbar", { name: "Onboarding progress" }),
  ).toHaveAttribute("aria-valuenow", "4");
  await expect(value).toHaveText("5");
  await decrease.click();
  await expect(value).toHaveText("4");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByTestId("coach-validation")).toBeVisible();
  const revisedState = await (await request.get(`${API}/__state`)).json();
  const revisedRhythm = revisedState.requests
    .filter(
      (r: any) =>
        r.path.endsWith("/interview") && r.body.state.stage === "rhythm",
    )
    .at(-1);
  expect(revisedRhythm?.body.answer).toBe("4 sessions a week");
  expect(
    revisedRhythm?.body.state.turns.filter(
      (turn: any) => turn.stage === "rhythm",
    ),
  ).toHaveLength(0);
  expect(revisedRhythm?.body.state.confirmed).not.toContain("rhythm");
  await continueAfterValidation(page);
  await page.getByRole("button", { name: "Yes, coach this plan" }).click();
  await reviewCoachTour(page);
  await expect(page.getByTestId("onboarding-plan-summary")).toContainText(
    "4 sessions a week · flexible days",
  );
});
test("Jev completes the goal without a second coach-validation screen", async ({
  page,
  request,
}) => {
  await request.post(`${API}/__reset`);
  await page.goto("/onboarding?preview=1");
  await expect(
    page.getByRole("button", { name: "Start over", exact: true }),
  ).toBeVisible();
  await answerGoal(page, "I want to write guitar songs to express myself");
  await expect(
    page.getByRole("progressbar", { name: "Automatic continue" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("progressbar", { name: "Onboarding progress" }),
  ).toHaveAttribute("aria-valuenow", "4");
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Previous question" }).click();
  await expect(page.getByRole("textbox", { name: "Your answer" })).toHaveValue(
    "I want to write guitar songs to express myself",
  );
});
test("optional goal context does not create a second validation screen", async ({
  page,
  request,
}) => {
  await request.post(`${API}/__reset`);
  await page.goto("/onboarding?preview=1");
  await answerGoal(page, "I want to write guitar songs");
  await expect(page.getByTestId("coach-validation")).toHaveCount(0);
  await expect(
    page.getByRole("progressbar", { name: "Automatic continue" }),
  ).toHaveCount(0);
});
test("each goal screen checks only its own answer and saves the context supplied", async ({ page, request }) => {
  await request.post(`${API}/__reset`);
  await page.goto("/onboarding?preview=1");
  await page.getByRole("textbox", { name: "Your answer" }).fill("Run my first half marathon under two hours");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "How much do you run now?" })).toBeVisible();
  await page.getByRole("textbox", { name: "Your answer" }).fill("I currently run two easy 3 km runs a week");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Why does this matter to you?" })).toBeVisible();
  await page.getByRole("button", { name: "Previous question" }).click();
  await expect(page.getByRole("textbox", { name: "Your answer" })).toHaveValue("I currently run two easy 3 km runs a week");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("textbox", { name: "Your answer" }).fill("I want to finish with my friends");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByTestId("onboarding-weekly-frequency-value")).toHaveText("3");
  const state = await (await request.get(`${API}/__state`)).json();
  expect(state.requests.filter((r: any) => r.path.endsWith("/goal-guidance")).map((r: any) => r.body.step)).toEqual(expect.arrayContaining(["goal", "baseline", "motivation"]));
});
test("coach role cards and review-time picker carry the chosen settings to the conclusion", async ({ page, request }) => {
  await request.post(`${API}/__reset`);
  await page.goto("/onboarding?preview=1");
  await answerGoal(page, "I want to write my own guitar songs");
  await chooseWeeklyFrequency(page);
  await continueAfterValidation(page);
  await page.getByRole("button", { name: "Yes, coach this plan" }).click();
  await page.getByRole("radio", { name: "Plan and adjust training" }).click();
  await expect(page.getByRole("radio", { name: "Plan and adjust training" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Review time 18:00" }).click();
  await page.getByRole("button", { name: "Hour 19" }).click();
  await expect(page.getByRole("button", { name: "Review time 19:00" })).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Review my plan" }).click();
  await page.getByRole("button", { name: "This feels right" }).click();
  await continueAfterValidation(page);
  await expect(page.getByText("Weekly review · Sunday 19:00")).toBeVisible();
});
test("Jev blocks nonsense and later interview errors can be retried", async ({
  page,
  request,
}) => {
  await request.post(`${API}/__reset`);
  await page.goto("/onboarding?preview=1");
  await page.getByRole("textbox", { name: "Your answer" }).fill("asdf");
  await expect(
    page.getByRole("button", { name: "Continue", exact: true }),
  ).toBeDisabled();
  await expect(page.getByTestId("goal-guidance")).toContainText("Name one concrete outcome");
  await answerGoal(page, "I want to write guitar songs because music matters to me");
  await request.post(`${API}/__fail`, {
    data: { path: "/follow-through/onboarding/interview" },
  });
  await expect(
    page.getByTestId("onboarding-weekly-frequency-value"),
  ).toHaveText("3");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByText("Simulated network failure. Please try again."),
  ).toBeVisible();
  await expect(
    page.getByTestId("onboarding-weekly-frequency-value"),
  ).toHaveText("3");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await continueAfterValidation(page);
  await expect(
    page.getByRole("progressbar", { name: "Onboarding progress" }),
  ).toHaveAttribute("aria-valuenow", "5");
  await expect(page.getByTestId("coach-validation")).toHaveCount(0);
});
test("start over resets a failed interview to the goal gate", async ({
  page,
  request,
}) => {
  await request.post(`${API}/__reset`);
  await page.goto("/onboarding?preview=1");
  await page
    .getByRole("textbox", { name: "Your answer" })
    .fill("I want to write songs");
  await expect(
    page.getByRole("button", { name: "Continue", exact: true }),
  ).toBeEnabled();
  await request.post(`${API}/__fail`, {
    data: { path: "/follow-through/onboarding/interview" },
  });
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Skip for now" }).click();
  await page.getByRole("button", { name: "Skip for now" }).click();
  await expect(
    page.getByRole("progressbar", { name: "Onboarding progress" }),
  ).toHaveAttribute("aria-valuenow", "4");
  await expect(
    page.getByTestId("onboarding-weekly-frequency-value"),
  ).toHaveText("3");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByText("Simulated network failure. Please try again."),
  ).toBeVisible();
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Previous question" }).click();
  await page.getByRole("button", { name: "Start over", exact: true }).click();
  await expect(
    page.getByRole("progressbar", { name: "Onboarding progress" }),
  ).toHaveAttribute("aria-valuenow", "1");
  await expect(page.getByRole("textbox", { name: "Your answer" })).toHaveValue(
    "",
  );
});
test("resume retains extracted answer and a delayed upgrade unlocks and continues exactly once", async ({
  page,
  request,
}) => {
  await request.post(`${API}/__reset`);
  await request.patch(`${API}/users/user`, {
    headers,
    data: { planType: "FREE" },
  });
  await page.goto("/onboarding");
  await toPaywall(page);
  await page.getByRole("button", { name: "Start coaching trial" }).click();
  await expect(
    page.getByRole("button", { name: "Check subscription again" }),
  ).toBeVisible();
  let state = await (await request.get(`${API}/__state`)).json();
  expect(
    state.requests.filter((r: any) => r.path.endsWith("/finish")),
  ).toHaveLength(0);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Check subscription again" }),
  ).toBeVisible();
  await request.patch(`${API}/users/user`, {
    headers,
    data: { planType: "PLUS" },
  });
  await expect(page).toHaveURL(/plans\?selectedPlan=/);
  state = await (await request.get(`${API}/__state`)).json();
  expect(
    state.requests.filter((r: any) => r.path.endsWith("/finish")),
  ).toHaveLength(1);
  expect(
    state.requests.find((r: any) => r.path.endsWith("/finish")).body.preferences
      .coaching,
  ).toBe(true);
});
test("declining the trial creates free tracking without checkout", async ({
  page,
  request,
}) => {
  await request.post(`${API}/__reset`);
  await request.patch(`${API}/users/user`, {
    headers,
    data: { planType: "FREE" },
  });
  await page.goto("/onboarding");
  await toPaywall(page);
  await request.post(`${API}/__fail`, {
    data: { path: "/follow-through/onboarding/finish" },
  });
  await page
    .getByRole("button", { name: "Continue with free tracking" })
    .click();
  await expect(
    page.getByText("Simulated network failure. Please try again."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Continue with free tracking" })
    .click();
  await expect(page).toHaveURL(/plans\?selectedPlan=/);
  const state = await (await request.get(`${API}/__state`)).json();
  expect(state.plans).toHaveLength(3);
  const finish = state.requests.filter((r: any) => r.path.endsWith("/finish")).at(-1);
  expect(finish.body.preferences.coaching).toBe(false);
  expect(finish.body.draft.wantsCoaching).toBe(false);
});
test("choosing tracking skips the coach tour and creates a free plan without a trial", async ({
  page,
  request,
}) => {
  await request.post(`${API}/__reset`);
  await request.patch(`${API}/users/user`, {
    headers,
    data: { planType: "FREE" },
  });
  await page.goto("/onboarding");
  await answerGoal(page, "I want to write guitar songs to express myself");
  await chooseWeeklyFrequency(page);
  await continueAfterValidation(page);
  await page.getByRole("button", { name: "No, just track it" }).click();
  await expect(page.getByTestId("coach-tour-role")).toHaveCount(0);
  await expect(page.getByTestId("coach-tour-contact")).toHaveCount(0);
  await expect(page.getByTestId("coach-tour-data")).toHaveCount(0);
  await expect(page.getByTestId("onboarding-plan-summary")).toBeVisible();
  await page.waitForTimeout(650);
  await page.screenshot({ path: "test-results/interview-free-review.png" });
  await page.getByRole("button", { name: "This feels right" }).click();
  await continueAfterValidation(page);
  await expect(
    page.getByRole("button", { name: "Start coaching trial" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Create my plan" }),
  ).toBeVisible();
  await page.waitForTimeout(650);
  await page.screenshot({ path: "test-results/interview-free-conclusion.png" });
  await page.getByRole("button", { name: "Create my plan" }).click();
  await expect(page).toHaveURL(/plans\?selectedPlan=/);
  const state = await (await request.get(`${API}/__state`)).json();
  expect(
    state.requests.filter((r: any) => r.path.endsWith("/offer")),
  ).toHaveLength(0);
  const finishes = state.requests.filter((r: any) =>
    r.path.endsWith("/finish"),
  );
  expect(finishes).toHaveLength(1);
  expect(finishes[0].body.preferences.coaching).toBe(false);
  expect(finishes[0].body.draft.wantsCoaching).toBe(false);
  expect(finishes[0].body.draft.interview.facts.baseline).toBe("");
  expect(finishes[0].body.draft.interview.facts.goalReason).toBe("");
  expect(state.plans).toHaveLength(3);
});
test("confirmed extraction survives closing and reopening onboarding", async ({
  page,
  request,
}) => {
  await request.post(`${API}/__reset`);
  await page.goto("/onboarding");
  await answerGoal(page, "I want to write guitar songs to express myself");
  await page.reload();
  await expect(
    page.getByRole("progressbar", { name: "Onboarding progress" }),
  ).toHaveAttribute("aria-valuenow", "4");
  await expect(page.getByTestId("coach-validation")).toHaveCount(0);
});

test("Jev keeps an unclear goal on the first gate", async ({
  page,
  request,
}) => {
  await request.post(`${API}/__reset`);
  await page.goto("/onboarding?preview=1");
  await page.getByRole("textbox", { name: "Your answer" }).fill("asdf");
  await expect(
    page.getByRole("button", { name: "Continue", exact: true }),
  ).toBeDisabled();
  await expect(page.getByTestId("coach-validation")).toHaveCount(0);
  await answerGoal(page, "I want to write guitar songs to express myself");
});
