/// <reference types="node" />
import { test, expect, Page } from "@playwright/test";
import { clerkSetup, setupClerkTestingToken } from "@clerk/testing/playwright";

// Store the created plan's URL to use in the second test
let createdPlanUrl: string;
let page: Page;

test.describe.serial("App", () => {
  test.beforeAll(async ({ browser }) => {
    page = await (await browser.newContext()).newPage();
    await clerkSetup();
    await page.goto(process.env.BASE_URL || "http://localhost:3000/");
    await setupClerkTestingToken({ page });

    await page
      .getByLabel("Email address")
      .fill(
        process.env.APP_TEST_USER_EMAIL ||
          "alexandre.ramalho.1998+e2etracking@gmail.com"
      );
    await page
      .getByLabel("Password", { exact: true })
      .fill(process.env.APP_TEST_USER_PASSWORD || "adfasdfasdfasdfasd");
    await page.getByRole("button", { name: "Continue", exact: true }).click();

    const closeButton = page.getByTestId("close-app-install-modal");
    if (await closeButton.isVisible()) {
      await closeButton.click();
    }
  });

  async function closePopoverIfPresent() {
    const closeButton = page.getByTestId("close-popover");
    if (await closeButton.isVisible()) {
      await closeButton.click();
    }
  }

  test("can create a specific plan", async () => {
    await page.waitForTimeout(1500);
    await closePopoverIfPresent();

    // Navigate to Plans and start creating a new plan
    await page.getByTestId("nav-plans").click();
    await page.getByText("Create New Plan").click();

    // Step 1: Duration Type and Optional Finishing Date
    await page.getByText("Custom", { exact: true }).click();

    // Optional: Set a finishing date
    await page.getByLabel("Set a target date (optional)").click();
    await page.getByRole("dialog").waitFor();
    await page.getByTestId("day-picker").locator("td").last().click();
    await page
      .getByRole("button", { name: "Next", exact: true })
      .and(page.locator("button:not([disabled])"))
      .last()
      .click();

    // Step 2: Fill in goal
    await page
      .getByLabel("Great, now what exactly do you want to do?")
      .fill("I want to exercise regularly and improve my fitness");
    await page
      .getByRole("button", { name: "Next", exact: true })
      .and(page.locator("button:not([disabled])"))
      .last()
      .click();

    // Step 3: Select an emoji
    await page
      .getByTestId("plan-configuration-form")
      .getByPlaceholder("Enter an emoji")
      .fill("🙂");
    await page
      .getByRole("button", { name: "Next", exact: true })
      .and(page.locator("button:not([disabled])"))
      .last()
      .click();

    await page.getByText("push-ups").click();

    // Create a new activity
    await page.getByRole("button", { name: "Add New" }).click();
    await page.getByPlaceholder("Activity Title").fill("Running");
    await page
      .getByTestId("activity-editor")
      .getByPlaceholder("Enter an emoji")
      .fill("🙂");
    await page
      .getByPlaceholder("Measure (e.g., minutes, times)")
      .fill("kilometers");
    await page.getByRole("button", { name: "Save Activity" }).click();
    await page
      .getByRole("button", { name: "Next", exact: true })
      .and(page.locator("button:not([disabled])"))
      .last()
      .click();

    // Step 5: Configure outline and generate plan
    await page.getByText("Specific Schedule").click();

    // Add customization for specific schedule
    await page
      .getByPlaceholder(
        "Example: I prefer morning workouts, I want to alternate between activities, etc..."
      )
      .fill(
        "I prefer morning workouts and would like to focus on cardio exercises"
      );

    await page.getByRole("button", { name: "Generate Plan" }).click();

    // Verify the generated plan
    await expect(page.getByText("🙂 running")).toBeVisible({
      timeout: 20000,
    });
    await expect(page.getByText("💪 push-ups")).toBeVisible();
    await expect(
      page.getByText("I want to exercise regularly and improve my fitness")
    ).toBeVisible();

    const filledCells = await page
      .locator('rect[fill]:not([fill="#EBEDF0"])')
      .count();
    expect(filledCells).toBeGreaterThan(0);

    await page
      .getByRole("button", { name: "Next", exact: true })
      .and(page.locator("button:not([disabled])"))
      .last()
      .click();
    await page.getByRole("button", { name: "Create Plan" }).click();
    await page.getByText("Enable Notifications").click();

    createdPlanUrl = page.url();
  });

  test("can create a times per week plan", async () => {
    // Navigate to Plans and start creating a new plan
    await page.getByTestId("nav-plans").click();
    await page.getByText("Create New Plan").click();

    // Step 1: Duration Type and Optional Finishing Date
    await page.getByText("Lifestyle").click();
    // Optional: Set a finishing date (skipping in this test)
    await page
      .getByRole("button", { name: "Next", exact: true })
      .and(page.locator("button:not([disabled])"))
      .last()
      .click();

    // Step 2: Fill in goal
    await page
      .getByLabel("Great, now what exactly do you want to do?")
      .fill("I want to meditate regularly");
    await page
      .getByRole("button", { name: "Next", exact: true })
      .and(page.locator("button:not([disabled])"))
      .last()
      .click();

    // Step 3: Select an emoji
    await page
      .getByTestId("plan-configuration-form")
      .getByPlaceholder("Enter an emoji")
      .fill("🧘");
    await page
      .getByRole("button", { name: "Next", exact: true })
      .and(page.locator("button:not([disabled])"))
      .last()
      .click();

    // Step 4: Select and create activities
    await page.getByText("push-ups").click();

    // Create a new activity
    await page.getByRole("button", { name: "Add New" }).click();
    await page
      .getByTestId("activity-editor")
      .getByPlaceholder("Enter an emoji")
      .fill("🙂");
    await page.getByPlaceholder("Activity Title").fill("Meditate");
    await page
      .getByPlaceholder("Measure (e.g., minutes, times)")
      .fill("minutes");
    await page.getByRole("button", { name: "Save Activity" }).click();
    await page
      .getByRole("button", { name: "Next", exact: true })
      .and(page.locator("button:not([disabled])"))
      .last()
      .click();

    // Step 5: Configure outline
    await page.getByText("Weekly Count Goal").click();
    await page.getByTestId("plus").click();
    await page.getByTestId("plus").click();
    await page
      .getByRole("button", { name: "Next", exact: true })
      .and(page.locator("button:not([disabled])"))
      .last()
      .click();

    await page.getByRole("button", { name: "Create Plan" }).click();
  });

  test("can edit an existing plan", async () => {
    await page.getByTestId("nav-plans").click();

    await page
      .getByText("I want to exercise regularly and improve my fitness")
      .last()
      .click();

    // Verify initial state
    await expect(page.getByText("🙂 running")).toBeVisible();
    await expect(page.getByText("💪 push-ups")).toBeVisible();

    await page.getByTestId("display-future-activities-switch").click();
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
    await pushUpsElement.scrollIntoViewIfNeeded();
    await pushUpsElement.click({ force: true });

    await page.waitForTimeout(1000);

    await page.getByRole("button", { name: "Generate Plan" }).click();
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
