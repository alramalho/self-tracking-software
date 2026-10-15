import { expect, type Page } from "@playwright/test";

// The dial is a half circle from 1 (left) to 10 (right). Tap the middle of a score's slice.
export async function rate(page: Page, score: number) {
  const dial = page.getByTestId("confidence-dial");
  const box = (await dial.boundingBox())!;
  const radius = (box.width - 22) / 2 - 6;
  const cx = box.width / 2;
  const cy = radius + 11 + 6;
  const angle = Math.PI * (1 - (score - 0.5) / 10);
  await dial.click({ position: { x: cx + radius * Math.cos(angle), y: cy - radius * Math.sin(angle) } });
  await expect(page.getByTestId("confidence-score")).toHaveText(String(score));
}

/** Sure enough to skip the lighter-plan offer, with a short reason. */
export async function commit(page: Page, score = 8, why = "I already run twice a week and my friends are in") {
  await expect(page.getByRole("heading", { name: "How sure are you that you’ll stick to this?" })).toBeVisible();
  await rate(page, score);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("textbox", { name: "Your answer" }).fill(why);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
}
