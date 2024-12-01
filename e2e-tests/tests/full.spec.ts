import { test, expect, Page } from "@playwright/test";
import { clerkSetup, setupClerkTestingToken } from "@clerk/testing/playwright";

// Store the created plan's URL to use in the second test
let createdPlanUrl: string;
let page: Page;

test.describe.serial("App", () => {
  test.beforeAll(async ({ browser }) => {
    page = await (await browser.newContext()).newPage();
    await clerkSetup();
    await page.goto("http://localhost:3000/");
    await setupClerkTestingToken({ page });

    await page.getByLabel("Email address").fill("tyvmgldzsifhjcpuwn@hthlm.com");
    await page
      .getByLabel("Password", { exact: true })
      .fill("adfasdfasdfasdfasd");
    await page.getByRole("button", { name: "Continue", exact: true }).click();

    try {
      await page.getByTestId("close-app-install-modal").click();
    } catch (error) {
      // Ignore if modal is not present
    }
  });

  test("can sign up and create a plan", async () => {
    // Navigate to Plans and start creating a new plan
    await page
      .locator("nav")
      .first()
      .getByRole("link", { name: "Plans" })
      .click();
    await page.getByText("Create New Plan").click();

    // Fill in the plan configuration form
    await page.getByText("Custom", { exact: true }).click();

    // Set a custom finishing date
    await page.getByLabel("Set a custom finishing date").click();
    await page.getByRole("dialog").waitFor();
    await page.getByTestId("day-picker").locator("td").last().click();

    await page
      .getByLabel("Great, now what exactly do you want to do?")
      .fill("I want to exercise regularly and improve my fitness");

    await page.getByRole("button", { name: "Continue", exact: true }).click();
    // Select an emoji
    await page.locator("#emoji-picker-trigger").click();
    await page
      .locator("button[data-full-name='grinning,grinning face']")
      .click();

    await page.getByText("push-ups").click();

    // Create a new activity
    await page.getByRole("button", { name: "Add New" }).click();
    await page.getByPlaceholder("Activity Title").fill("Running");
    await page
      .getByPlaceholder("Measure (e.g., minutes, times)")
      .fill("kilometers");

    await page.getByTestId("emoji-picker-button").click();
    await page
      .locator("button[data-full-name='slightly smiling face']")
      .click();

    await page.getByRole("button", { name: "Save Activity" }).click();

    // Toggle "Only use selected activities"
    await page.getByLabel("Only use selected activities").click();

    // Add additional customization
    await page
      .getByLabel("Additional Customization")
      .fill(
        "I prefer morning workouts and would like to focus on cardio exercises"
      );

    // Generate and create the plan
    await page.getByRole("button", { name: "Generate Plan" }).click();

    // Verify the created plan
    await expect(page.getByText("🙂 running")).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText("💪 push-ups")).toBeVisible();
    await expect(
      page.getByText(
        "Goal: I want to exercise regularly and improve my fitness"
      )
    ).toBeVisible();

    const filledCells = await page
      .locator('rect[fill]:not([fill="#EBEDF0"])')
      .count();
    expect(filledCells).toBeGreaterThan(0);

    await page.getByRole("button", { name: "Create Plan" }).click();
    await page.getByText("Enable Notifications").click();

    // Store the current URL for the next test
    createdPlanUrl = page.url();
  });

  test("can edit an existing plan", async () => {
    await page
      .locator("nav")
      .first()
      .getByRole("link", { name: "Plans" })
      .click();

    await page
      .getByText("I want to exercise regularly and improve my fitness")
      .last()
      .click();

    // Verify initial state
    await expect(page.getByText("🙂 running")).toBeVisible();
    await expect(page.getByText("💪 push-ups")).toBeVisible();

    const initialFilledCells = await page
      .locator('rect[fill]:not([fill="#EBEDF0"])')
      .count();
    expect(initialFilledCells).toBeGreaterThan(0);

    // Edit the plan
    const planCard = page.locator('[data-testid="plan-card"]', {
      hasText: "I want to exercise regularly and improve my fitness",
    });
    await planCard.getByTestId("plan-settings-button").last().click();

    await page.getByRole("button", { name: "Edit Plan" }).click();

    const existingActivitiesSection = page.getByTestId("existing-activities");
    const pushUpsElement = existingActivitiesSection.getByText("push-ups");
    await pushUpsElement.click({ force: true });

    await page.waitForTimeout(1000);

    await page.getByRole("button", { name: "Generate Update" }).click();
    await expect(page.getByText("Generating...")).toBeVisible();
    await expect(page.getByText("Generating...")).not.toBeVisible({
      timeout: 15000,
    });

    // Verify the changes
    const planConfigurationForm = page.getByTestId("plan-configuration-form");
    await expect(
      planConfigurationForm.getByText("🙂 running").first()
    ).toBeVisible({
      timeout: 15000,
    });
    await expect(
      planConfigurationForm.getByText("💪 push-ups")
    ).not.toBeVisible();

    await planConfigurationForm
      .getByRole("button", { name: "Confirm Update" })
      .click();
    await expect(page.getByText("Plan updated successfully")).toBeVisible();
  });
});
