import { expect, type Page } from "@playwright/test";

/** After a successful log the "Nice work!" moment plays; a tap closes it and the usual next step follows. */
export async function closeCelebration(page: Page) {
  const overlay = page.getByTestId("log-celebration");
  await expect(overlay).toBeVisible();
  await overlay.click({ position: { x: 20, y: 20 } });
  await expect(overlay).toHaveCount(0);
}
