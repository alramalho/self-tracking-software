import { test, expect } from "@playwright/test";
const API = `http://127.0.0.1:${process.env.E2E_API_PORT || "4317"}`;
const lia = "Lia Borges, @liocas";

for (const theme of ["DARK", "LIGHT"]) test(`search explores circles and people, then finds names and goals in ${theme}`, async ({ page, request }) => {
  await request.post(`${API}/__reset`);
  await request.post(`${API}/__people-search`);
  await request.patch(`${API}/users/user`, { headers: { Authorization: "Bearer local-e2e-token" }, data: { themeMode: theme, themeBaseColor: "AMBER" } });
  await page.goto("/search");
  const input = page.getByRole("textbox", { name: "Search people and circles" });
  await expect(page.getByRole("button", { name: "Lisbon morning runners, Lisbon · 3–4 a week" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Marta Sousa, 🏃‍♀️ Run a half marathon" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Slow readers club, Porto · 4–5 a week" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `test-results/explore-${theme}.png`, fullPage: true });

  await input.fill("guitar");
  await expect(page.getByRole("button", { name: "Guitar every evening, 5 a week" })).toBeVisible();
  await expect(page.getByRole("button", { name: "João Pereira, 🎸 Learn guitar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Lisbon morning runners, Lisbon · 3–4 a week" })).toHaveCount(0);
  await page.screenshot({ path: `test-results/explore-typed-${theme}.png` });

  await input.fill("Lia");
  await page.getByRole("button", { name: lia, exact: true }).click();
  await expect(page).toHaveURL(/profile\/liocas/);
  // Back from a profile opened here returns to Home (as on main), so start again.
  await page.goto("/search");

  await input.fill("zzzzzz");
  await expect(page.getByText("Nothing matches. Try another name, username or goal.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await expect(input).toHaveValue("");
  await expect(page.getByRole("button", { name: "Marta Sousa, 🏃‍♀️ Run a half marathon" })).toBeVisible();
});

test("a circle you could join opens its join sheet", async ({ page, request }) => {
  await request.post(`${API}/__reset`);
  await page.goto("/search");
  await page.getByRole("button", { name: "Lisbon morning runners, Lisbon · 3–4 a week" }).click();
  await expect(page.getByText("Lisbon morning runners").last()).toBeVisible();
  await page.screenshot({ path: "test-results/explore-join.png" });
});

test("a failed search keeps the query and can be retried", async ({ page, request }) => {
  await request.post(`${API}/__reset`); await request.post(`${API}/__people-search`);
  await page.goto("/search");
  let failing = true;
  await page.route(`${API}/users/search-users/Lia`, (route) => failing ? route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Search unavailable" }) }) : route.continue());
  const input = page.getByRole("textbox", { name: "Search people and circles" });
  await input.fill("Lia");
  await expect(page.getByText("Couldn't load everything.", { exact: false })).toBeVisible();
  await expect(input).toHaveValue("Lia");
  failing = false;
  await page.getByText("Try again", { exact: true }).click();
  await expect(page.getByRole("button", { name: lia, exact: true })).toBeVisible();
});
