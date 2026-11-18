import { test, expect, type Page } from "@playwright/test";
const API = `http://127.0.0.1:${process.env.E2E_API_PORT || "4317"}`;
const headers = { Authorization: "Bearer local-e2e-token" };

async function shot(page: Page, name: string) {
  await page.waitForTimeout(700);
  await page.screenshot({ path: `test-results/plan-edit-unsaved/${name}.png` });
}

async function openEditor(page: Page, request: any, theme: string) {
  await request.post(`${API}/__reset`);
  await request.patch(`${API}/users/user`, { headers, data: { themeMode: theme } });
  await page.goto("/");
  await page.getByTestId("nav-plans").click();
  await page.getByRole("button", { name: "Exercise regularly", exact: true }).click();
  await page.getByRole("button", { name: "Plan settings" }).click();
  await page.getByRole("button", { name: "Edit plan" }).click();
  await expect(page.getByRole("button", { name: "Edit goal", exact: true })).toBeVisible();
}

async function changeGoalReason(page: Page) {
  await page.getByRole("button", { name: "Edit goal", exact: true }).click();
  await page.getByLabel("Why is this important to you?").fill("Feel stronger");
  await page.getByRole("button", { name: "Done", exact: true }).click();
}

for (const theme of ["LIGHT", "DARK"]) {
  test(`save is on screen without scrolling (${theme})`, async ({ page, request }) => {
    await openEditor(page, request, theme);
    await expect(page.getByRole("button", { name: "Save changes", exact: true })).toBeInViewport();
    await shot(page, `1-overview-${theme}`);
  });
}

test("leaving with no changes asks nothing", async ({ page, request }) => {
  await openEditor(page, request, "DARK");
  let asked = false;
  page.on("dialog", (dialog) => {
    asked = true;
    void dialog.accept();
  });
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit goal", exact: true })).toHaveCount(0);
  expect(asked).toBe(false);
});

test("leaving with unsaved changes asks first", async ({ page, request }) => {
  await openEditor(page, request, "DARK");
  await changeGoalReason(page);

  const messages: string[] = [];
  page.once("dialog", (dialog) => {
    messages.push(dialog.message());
    void dialog.dismiss();
  });
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect.poll(() => messages.length).toBe(1);
  expect(messages[0]).toContain("Discard changes?");
  await expect(page.getByRole("button", { name: "Save changes", exact: true })).toBeVisible();

  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("button", { name: "Save changes", exact: true })).toHaveCount(0);
});

test("saving leaves without asking", async ({ page, request }) => {
  await openEditor(page, request, "DARK");
  await changeGoalReason(page);
  let asked = false;
  page.on("dialog", (dialog) => {
    asked = true;
    void dialog.accept();
  });
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByTestId("plans-screen")).toBeVisible();
  expect(asked).toBe(false);
});
