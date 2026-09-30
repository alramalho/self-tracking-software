import { expect, type Page } from "@playwright/test";

export async function selectWelcomeAge(page: Page, age = 29) {
  const value = page.getByTestId("onboarding-welcome-age-value");
  await expect(value).toBeVisible();
  let current = Number(await value.textContent());
  while (current !== age) {
    await page.getByRole("button", { name: current < age ? "Increase age" : "Decrease age", exact: true }).click();
    current += current < age ? 1 : -1;
    await expect(value).toHaveText(String(current));
  }
}

export async function enterWelcomeAge(page: Page, age = 29) {
  await page.getByRole("button", { name: "I'm ready!" }).click();
  await selectWelcomeAge(page, age);
}
