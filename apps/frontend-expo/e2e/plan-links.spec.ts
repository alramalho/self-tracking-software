import { test, expect } from "@playwright/test";
const API = "http://127.0.0.1:4317";
for (const theme of ["DARK", "LIGHT"]) {
  test(`coach overview resolves plan and activity links in ${theme}`, async ({
    page,
    request,
  }) => {
    await request.post(`${API}/__reset`);
    await request.patch(`${API}/users/user`, {
      headers: { Authorization: "Bearer local-e2e-token" },
      data: {
        themeMode: theme,
        themeBaseColor: "AMBER",
        coachPersonality: "STRATEGIST",
      },
    });
    await request.post(`${API}/__coach-overview`);
    await page.goto("/plans?selectedPlan=fitness");
    await page.getByRole("button", { name: "Coach overview", exact: true }).click();
    const overview = page.getByTestId("coach-overview");
    const flexibleMarker = overview
      .getByRole("button", { name: /Planned Exercise regularly on/ })
      .first();
    await flexibleMarker.click();
    await expect(overview.getByTestId("selected-flexible-slot")).toContainText(
      "Flexible weekly slot",
    );
    await expect(
      page.getByRole("heading", { name: "Planned activity", exact: true }),
    ).not.toBeVisible();
    await expect(
      overview.getByRole("button", { name: "Log Activity", exact: true }),
    ).toHaveCount(0);
    await expect(
      overview.getByRole("link", { name: "train 4 times a week", exact: true }),
    ).toBeVisible();
    await expect(overview).not.toContainText("{{plan:");
    await expect(overview).not.toContainText("{{activity:");
    await expect(overview).not.toContainText("**2/4**");
    await page.screenshot({
      path: `test-results/plan-links-${theme.toLowerCase()}.png`,
    });
    await overview
      .getByRole("link", { name: "your runs", exact: true })
      .click();
    await expect(page.getByText("kilometers", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Close Activity", exact: true }).click();
    await overview
      .getByRole("link", { name: "train 4 times a week", exact: true })
      .click();
    await page.getByRole("button", { name: "View full plan", exact: true }).click();
    await expect(page).toHaveURL(/\/plan\/fitness/);
    await expect(
      page.getByTestId("plan-detail-fitness").getByText("Exercise regularly", { exact: true }),
    ).toBeVisible();
    await page.goBack();
    await overview
      .getByRole("link", { name: "your reading plan", exact: true })
      .click();
    await page.getByRole("button", { name: "View full plan", exact: true }).click();
    await expect(page).toHaveURL(/\/plan\/scheduled/);
    await expect(
      page.getByTestId("plan-detail-scheduled").getByText("Read every day", { exact: true }),
    ).toBeVisible();
  });
}
