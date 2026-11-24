import { test, expect } from "@playwright/test";
const API = "http://127.0.0.1:4317";
const auth = { Authorization: "Bearer local-e2e-token" };

for (const theme of ["LIGHT", "DARK"])
  test(`Privacy & safety shows this month's AI uses against the fair-use allowance (${theme})`, async ({ page, request }) => {
    await request.post(`${API}/__reset`);
    await request.patch(`${API}/users/user`, { headers: auth, data: { themeMode: theme, aiConsentGrantedAt: new Date().toISOString(), aiConsentDeclinedAt: null } });
    await page.goto("/settings");
    await page.getByRole("button", { name: "Privacy & safety", exact: true }).click();
    await expect(page.getByTestId("ai-usage")).toContainText("37 of 150");
    await expect(page.getByText(/fair-use allowance of 150 uses a month/)).toBeVisible();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `../../../output/fair-use/settings-${theme}.png` });
  });

test("no usage row while AI features are off", async ({ page, request }) => {
  await request.post(`${API}/__reset`);
  await request.patch(`${API}/users/user`, { headers: auth, data: { aiConsentGrantedAt: null } });
  await page.goto("/settings");
  await page.getByRole("button", { name: "Privacy & safety", exact: true }).click();
  await expect(page.getByRole("switch", { name: "AI features" })).toBeVisible();
  await expect(page.getByTestId("ai-usage")).toHaveCount(0);
});
