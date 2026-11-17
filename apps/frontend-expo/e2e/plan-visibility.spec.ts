import { test, expect, type Page } from "@playwright/test";
const API = `http://127.0.0.1:${process.env.E2E_API_PORT || "4317"}`;
const headers = { Authorization: "Bearer local-e2e-token" };
const next = (page: Page, name = "Continue") => page.getByRole("button", { name, exact: true }).click();

async function shot(page: Page, name: string) {
  await page.waitForTimeout(700);
  await page.screenshot({ path: `test-results/plan-visibility/${name}.png` });
}

async function setup(page: Page, request: any, theme: string) {
  await request.post(`${API}/__reset`);
  await request.patch(`${API}/users/user`, { headers, data: { themeMode: theme } });
}

for (const theme of ["LIGHT", "DARK"]) {
  test(`a new plan asks who sees it, right after the circle (${theme})`, async ({ page, request }) => {
    test.setTimeout(90000);
    await setup(page, request, theme);
    await page.goto("/create-plan?voiceGoal=Run%20my%20first%20half%20marathon");
    await next(page);
    await expect(page.getByRole("heading", { name: "How much do you run now?" })).toBeVisible();
    await next(page);
    await page.getByRole("button", { name: "Skip this question" }).click();
    await page.getByRole("button", { name: "No target in mind" }).click();
    await next(page, "Ask my coach");
    await page.getByTestId("route-steady").click();
    await next(page);
    for (let i = 0; i < 3; i++) await next(page);
    await page.getByRole("button", { name: "Just me" }).click();

    await expect(page.getByRole("heading", { name: "Who sees this plan?" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Everyone" })).toBeVisible();
    await shot(page, `1-create-step-${theme}`);

    await page.getByRole("button", { name: "Hide everything" }).click();
    await shot(page, `2-create-hide-everything-${theme}`);

    await next(page);
    await expect(page.getByRole("heading", { name: "How sure are you that you’ll stick to this?" })).toBeVisible();
    const state = await (await request.get(`${API}/__state`)).json();
    const saved = state.requests.filter((r: any) => r.path.endsWith("/onboarding/draft")).at(-1);
    expect(saved.body.visibility).toBe("PRIVATE");

    // Back from the dial returns to the choice, not to the circle.
    await page.getByRole("button", { name: "Previous question" }).click();
    await expect(page.getByRole("heading", { name: "Who sees this plan?" })).toBeVisible();
  });

  test(`plan settings offer the same three choices (${theme})`, async ({ page, request }) => {
    await setup(page, request, theme);
    await page.goto("/edit-plan/scheduled");
    await page.getByRole("button", { name: "Edit visibility" }).click();
    await expect(page.getByRole("heading", { name: "Who sees this plan?" })).toBeVisible();
    await page.getByRole("button", { name: "Hide the plan" }).click();
    await expect(page.getByTestId("plan-visibility-shared-note")).toHaveCount(0);
    await shot(page, `3-settings-hide-plan-${theme}`);
    // Reading is also in the public "Exercise regularly" plan, so its logs keep showing.
    await page.getByRole("button", { name: "Hide everything" }).click();
    await expect(page.getByTestId("plan-visibility-shared-note")).toContainText("Reading is also in 💪 Exercise regularly");
    await shot(page, `3b-settings-shared-note-${theme}`);
    await page.getByRole("button", { name: "Hide the plan" }).click();
    await page.getByRole("button", { name: "Done" }).click();
    await expect(page.getByText("Hide the plan")).toBeVisible();
    await shot(page, `4-settings-overview-${theme}`);
  });
}
