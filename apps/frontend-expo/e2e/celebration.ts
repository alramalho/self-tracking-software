import { expect, type Page } from "@playwright/test";

/**
 * After a successful log the "Nice work!" moment plays over the "Saved" sheet and fades into it (a tap
 * closes it sooner); Done on the sheet moves on to the usual next step.
 */
export async function closeCelebration(page: Page) {
  const overlay = page.getByTestId("log-celebration");
  await expect(overlay).toBeVisible();
  await overlay.click({ position: { x: 20, y: 20 } });
  await expect(overlay).toHaveCount(0);
  await page.getByTestId("saved-done").click();
}

/** Waits for the celebration to close by itself, with no tap. */
export async function waitForCelebration(page: Page) {
  await expect(page.getByTestId("log-celebration")).toBeVisible({ timeout: 8000 });
  await expect(page.getByTestId("log-celebration")).toHaveCount(0, { timeout: 15000 });
}
