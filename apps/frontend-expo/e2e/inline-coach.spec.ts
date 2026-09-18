import { test, expect } from "@playwright/test";
const API = "http://127.0.0.1:4317";
for (const theme of ["DARK", "LIGHT"])
  test(`faithful inline coach references and previews in ${theme}`, async ({
    page,
    request,
  }) => {
    await request.post(`${API}/__reset`);
    await request.post(`${API}/__inline-coach`);
    await request.patch(`${API}/users/user`, {
      headers: { Authorization: "Bearer local-e2e-token" },
      data: { themeMode: theme },
    });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/chat/coach-main");
    await expect(
      page.getByRole("link", { name: "train 4 times a week", exact: true }),
    ).toHaveCount(1);
    await expect(
      page.getByRole("link", { name: "your reading plan", exact: true }),
    ).toHaveCount(1);
    await expect(
      page.getByRole("button", { name: /Exercise regularly|Read every day/ }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "your previous goal", exact: true }),
    ).toHaveCount(0);
    await page.screenshot({ path: `test-results/inline-coach-${theme}.png` });
    await page
      .getByRole("link", { name: "train 4 times a week", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Good response" }),
    ).not.toBeVisible();
    await expect(page).toHaveURL(/chat\/coach-main/);
    await expect(page.getByText("Activities", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Close Plan Preview" }).click();
    await page
      .getByRole("link", { name: "your reading plan", exact: true })
      .click();
    await expect(
      page.getByText("Upcoming this week", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: /^Session:/ }).click();
    await expect(
      page.getByText("Read ten pages slowly and write down one idea."),
    ).toBeVisible();
    await page.getByRole("button", { name: "Back to plan preview" }).click();
    await page.screenshot({ path: `test-results/inline-preview-${theme}.png` });
    await page.getByRole("button", { name: "View full plan" }).click();
    await expect(page).toHaveURL(/plan\/scheduled/);
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(page).toHaveURL(/chat\/coach-main/);
    await page.getByRole("link", { name: "energetic", exact: true }).click();
    await expect(
      page.getByText("Log 4/5 for Energy?", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Accept", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Close Metric Suggestion" }),
    ).not.toBeVisible();
    const state = await (await request.get(`${API}/__state`)).json();
    expect(
      state.requests.some(
        (r: any) => r.path === "/ai/messages/inline-dsl/accept-metric",
      ),
    ).toBeTruthy();
    await page.getByRole("button", { name: "Back to messages" }).click();
    await expect(page).toHaveURL(/\/messages$/);
    expect(errors).toEqual([]);
  });

test("failed metric acceptance stays reviewable and rejection removes the inline suggestion", async ({ page, request }) => {
  await request.post(`${API}/__reset`);
  await request.post(`${API}/__inline-coach`);
  await page.goto("/chat/coach-main");
  await page.getByRole("link", { name: "energetic", exact: true }).click();
  await request.post(`${API}/__fail`, { data: { path: "/ai/messages/inline-dsl/accept-metric" } });
  await page.getByRole("button", { name: "Accept", exact: true }).click();
  await expect(page.getByText("Simulated network failure", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reject", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Reject", exact: true }).click();
  await expect(page.getByRole("button", { name: "Close Metric Suggestion" })).not.toBeVisible();
  await expect(page.getByRole("link", { name: "energetic", exact: true })).toHaveCount(0);
});
