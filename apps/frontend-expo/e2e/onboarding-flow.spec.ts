import { test, expect, type Page } from "@playwright/test";
const API = "http://127.0.0.1:4317";
const headers = { Authorization: "Bearer local-e2e-token" };
async function answer(page: Page, value: string) {
  await expect(
    page.getByRole("button", { name: "Dictate answer" }),
  ).toBeVisible();
  await page.getByRole("textbox", { name: "Your answer" }).fill(value);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByTestId("coach-validation")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue", exact: true }),
  ).toBeVisible();
}
async function continueAfterValidation(page: Page) {
  await page.getByRole("button", { name: "Continue", exact: true }).click();
}
async function toPaywall(page: Page, coaching = true) {
  await answer(page, "I want to write guitar songs to express myself");
  await continueAfterValidation(page);
  await answer(page, "I know a few chords but changes are slow");
  await continueAfterValidation(page);
  await answer(page, "Three times a week; the days can be flexible");
  await continueAfterValidation(page);
  await page
    .getByRole("button", {
      name: coaching
        ? "Help me shape a plan"
        : "I know my plan — just tracking",
      exact: true,
    })
    .click();
  await continueAfterValidation(page);
  await expect(page.getByTestId("onboarding-plan-summary")).toContainText(
    "Guitar practice",
  );
  await page.getByRole("button", { name: "This feels right" }).click();
  await continueAfterValidation(page);
}
for (const theme of ["DARK", "LIGHT"])
  test(`coach interview preview shares all five gates without account writes in ${theme}`, async ({
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
    ).toHaveLength(5);
    expect(
      state.requests.filter(
        (r: any) => r.path.endsWith("/draft") || r.path.endsWith("/finish"),
      ),
    ).toHaveLength(0);
    expect(state.plans).toHaveLength(2);
  });
test("coach validation auto-continues only after its rendered message", async ({
  page,
  request,
}) => {
  await request.post(`${API}/__reset`);
  await page.goto("/onboarding?preview=1");
  await page
    .getByRole("textbox", { name: "Your answer" })
    .fill("I want to write guitar songs to express myself");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByTestId("coach-validation")).toBeVisible();
  await expect(
    page.getByRole("progressbar", { name: "Automatic continue" }),
  ).toBeVisible();
  await expect(
    page.getByRole("progressbar", { name: "Onboarding progress" }),
  ).toHaveAttribute("aria-valuenow", "2", { timeout: 16000 });
});
test("nonsense, contradiction and network failure keep the answer at its current gate", async ({
  page,
  request,
}) => {
  await request.post(`${API}/__reset`);
  await page.goto("/onboarding?preview=1");
  await page.getByRole("textbox", { name: "Your answer" }).fill("asdf");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByTestId("coach-validation")).toBeVisible();
  await page.getByRole("button", { name: "Improve my answer" }).click();
  await expect(
    page.getByText("What is one thing you actually want to practise?"),
  ).toBeVisible();
  await expect(page.getByText("Make this answer more concrete")).toBeVisible();
  await expect(
    page.getByRole("progressbar", { name: "Onboarding progress" }),
  ).toHaveAttribute(
    "aria-valuenow",
    "1",
  );
  await request.post(`${API}/__fail`, {
    data: { path: "/follow-through/onboarding/interview" },
  });
  await page
    .getByRole("textbox", { name: "Your answer" })
    .fill("Guitar songs because music matters to me");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByText("Simulated network failure. Please try again."),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Your answer" })).toHaveValue(
    "Guitar songs because music matters to me",
  );
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await continueAfterValidation(page);
  await answer(page, "Complete beginner");
  await continueAfterValidation(page);
  await page
    .getByRole("textbox", { name: "Your answer" })
    .fill("Seven days, but only three days available");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByTestId("coach-validation")).toBeVisible();
  await page.getByRole("button", { name: "Improve my answer" }).click();
  await expect(
    page.getByText("Three sessions or seven — which fits?"),
  ).toBeVisible();
  await expect(
    page.getByRole("progressbar", { name: "Onboarding progress" }),
  ).toHaveAttribute(
    "aria-valuenow",
    "3",
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
test("free tracking preserves the coached draft without requiring checkout", async ({
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
  expect(
    state.requests.filter((r: any) => r.path.endsWith("/finish")).at(-1).body
      .preferences.coaching,
  ).toBe(false);
});
test("confirmed extraction survives closing and reopening onboarding", async ({
  page,
  request,
}) => {
  await request.post(`${API}/__reset`);
  await page.goto("/onboarding");
  await answer(page, "I want to write guitar songs to express myself");
  await page.reload();
  await expect(page.getByTestId("onboarding-extraction")).toContainText(
    "Write my own guitar songs",
  );
  await continueAfterValidation(page);
  await expect(
    page.getByRole("progressbar", { name: "Onboarding progress" }),
  ).toHaveAttribute(
    "aria-valuenow",
    "2",
  );
});

test("a rejected refinement cannot restore an earlier accepted extraction after reload", async ({
  page,
  request,
}) => {
  await request.post(`${API}/__reset`);
  await page.goto("/onboarding");
  await answer(page, "Guitar songs to express myself");
  await page.getByRole("button", { name: "Edit my answer" }).click();
  await page.getByRole("textbox", { name: "Your answer" }).fill("asdf");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByTestId("coach-validation")).toBeVisible();
  await page.getByRole("button", { name: "Improve my answer" }).click();
  await expect(
    page.getByText("What is one thing you actually want to practise?"),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("What is one thing you actually want to practise?"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Edit my answer" }),
  ).toHaveCount(0);
});
