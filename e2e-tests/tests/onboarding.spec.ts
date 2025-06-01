/// <reference types="node" />
import { test, expect, Page } from "@playwright/test";
import { clerkSetup, setupClerkTestingToken } from "@clerk/testing/playwright";

let page: Page;

test.describe.serial("Onboarding Flow", () => {
  test.beforeAll(async ({ browser }) => {
    page = await (await browser.newContext()).newPage();
    await clerkSetup();
    await page.goto(process.env.BASE_URL || "http://localhost:3000/");
    await setupClerkTestingToken({ page });

    await page
      .getByLabel("Email address")
      .fill("alexandre.ramalho.1998+e2etracking@gmail.com");
    await page
      .getByLabel("Password", { exact: true })
      .fill("adfasdfasdfasdfasd");
    await page.getByRole("button", { name: "Continue", exact: true }).click();

    const closeButton = page.getByTestId("close-app-install-modal");
    if (await closeButton.isVisible()) {
      await closeButton.click();
    }
  });

  async function deletePlanIfExists(planName: string) {
    await goToPage("/plans");

    const planCard = page.locator('[data-testid="plan-card"]', {
      has: page.getByText(planName, { exact: true }),
    });

    if (await planCard.isVisible()) {
      await planCard.getByTestId("plan-settings-button").click();
      await page.getByRole("button", { name: "Leave Plan" }).click();
      await page.waitForTimeout(1000);
      await page.getByRole("button", { name: "Leave Plan" }).click();

      await expect(planCard).not.toBeVisible();
    }
  }

  async function deleteActivityIfExists(activityTitle: string) {
    await goToPage("/add");

    const activityCard = page.locator('[data-testid="activity-card"]', {
      has: page.getByText(activityTitle, { exact: true }),
    });

    if (await activityCard.isVisible()) {
      await activityCard.getByRole("button", { name: "Edit" }).click();

      await page.getByRole("button", { name: "Delete" }).click();

      await page.getByRole("button", { name: "Delete", exact: true }).click();

      await expect(activityCard).not.toBeVisible();
    }
  }

  async function verifyPlanCreation(planName: string) {
    const planCard = page.locator('[data-testid="plan-card"]', {
      has: page.getByText(planName, { exact: true }),
    });
    await expect(planCard).toBeVisible();
  }

  async function selectPlan(planName: string) {
    const planHeading = page.getByRole("heading", { name: planName });
    const hasHeading = (await planHeading.count()) > 0;

    if (!hasHeading) {
      const planCard = page.locator('[data-testid="plan-card"]', {
        has: page.getByText(planName, { exact: true }),
      });
      await planCard.click();
    }
  }

  async function verifyActivityCreation(activityTitle: string) {
    await selectPlan("Read 12 Books");

    await expect(page.getByText(activityTitle)).toBeVisible();
  }

  async function verifyMilestones() {
    const milestones = page.getByText(/Book \d+/);
    const count = await milestones.count();
    expect(count).toBe(1);
  }

  async function goToPage(path: string) {
    const baseUrl = process.env.BASE_URL || "http://localhost:3000";
    await page.goto(baseUrl + path);
    await page.waitForTimeout(2000);
  }

  async function waitAndClickButton(page, buttonName, timeout = 60000) {
    const button = page.getByRole("button", { name: buttonName });

    // Wait for button to be enabled with timeout
    await expect(button).toBeEnabled({ timeout });

    // Click the button
    await button.click();
  }

  async function waitAndFillTextArea(page, text, timeout = 90000) {
    const textArea = page.getByRole("textbox");
    await expect(textArea).toBeEnabled({ timeout });
    await textArea.fill(text);
  }

  test("can create books plan through onboarding", async () => {
    // ⚠️ REMEMBER TO MANUALLY CREATE THE USER BEFORE AND DELETE ITS USER.PROFILE BEFORE STARTING
    // await deleteProfileIfExists();
    await deleteActivityIfExists("Reading");
    await deletePlanIfExists("Read 12 Books");

    await goToPage("/onboarding");

    await page.getByText("Let's go!", { exact: true }).click();

    // profile setup step
    await waitAndFillTextArea(
      page,
      "I am a 27 Male software engineer who loves reading books."
    );

    await waitAndClickButton(page, "Send");
    await waitAndClickButton(page, "Next");

    // plan creator step
    await waitAndFillTextArea(
      page,
      "I want to 'Read 12 books' this year to improve my knowledge and learn new things."
    );
    await waitAndClickButton(page, "Send");

    await page.getByRole("textbox").first().fill("3 times per week.");
    await waitAndClickButton(page, "Send");
    await waitAndClickButton(page, "Accept");

    await expect(
      page.getByText("Let's log you some activities!")
    ).toBeVisible();

    // activity logging step
    await waitAndFillTextArea(
      page,
      "This week I read 100 pages. 20 on monday and the rest between tuesday and friday."
    );
    await waitAndClickButton(page, "Send");
    await waitAndClickButton(page, "Accept");

    // DID NOT GO PAST THIS STEP
    await expect(
      page.getByText("Lastly, are you interested in an accountability partner?")
    ).toBeVisible();

    // accountability partner step
    await waitAndClickButton(page, "Yes");

    await verifyPlanCreation("Read 12 Books");

    await verifyActivityCreation("reading");

    await verifyMilestones();
  });
});
