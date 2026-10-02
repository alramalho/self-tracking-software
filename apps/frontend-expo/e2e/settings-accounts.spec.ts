import { test, expect } from "@playwright/test";
const API = `http://127.0.0.1:${process.env.E2E_API_PORT || 4317}`;
for (const theme of ["DARK", "LIGHT"]) test(`settings lists Accounts, and web offers no second account in ${theme}`, async ({ page, request }) => {
  await request.post(`${API}/__reset`); await request.patch(`${API}/users/user`, { headers: { Authorization: "Bearer local-e2e-token" }, data: { themeMode: theme, themeBaseColor: "AMBER" } });
  await page.goto("/settings");
  await expect(page.getByRole("button", { name: "User Settings", exact: true })).toBeVisible();
  await page.waitForTimeout(400); await page.screenshot({ path: `test-results/settings-main-${theme}.png` });
  await page.getByRole("button", { name: "Accounts", exact: true }).click();
  await expect(page.getByRole("button", { name: "Back to Settings" })).toBeVisible();
  // A browser has no secure place for switch tokens, so the switcher is native only.
  await expect(page.getByRole("button", { name: "Add account", exact: true })).toHaveCount(0);
  await page.waitForTimeout(400); await page.screenshot({ path: `test-results/settings-accounts-${theme}.png` });
  await page.getByRole("button", { name: "Back to Settings" }).click();
  await expect(page.getByRole("button", { name: "Accounts", exact: true })).toBeVisible();
});
