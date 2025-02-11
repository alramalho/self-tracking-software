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

  test("can create books plan through onboarding", async () => {
    await deleteActivityIfExists("Reading");
    await deletePlanIfExists("Read 12 Books");

    await goToPage("/onboarding");

    await page.getByText("Read 12 Books", { exact: true }).click();

    await page.getByRole("button", { name: "Create Plan" }).click();

    await page.getByRole("button", { name: "Continue to Dashboard" }).click();

    await verifyPlanCreation("Read 12 Books");

    await verifyActivityCreation("Reading");

    await verifyMilestones();
  });
});
