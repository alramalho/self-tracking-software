import { test, expect } from "@playwright/test";
const API = "http://127.0.0.1:4317";
for (const theme of ["DARK", "LIGHT"]) {
  test(`compact activity editor and color palette in ${theme}`, async ({
    page,
    request,
  }) => {
    await request.post(`${API}/__reset`);
    await request.patch(`${API}/users/user`, {
      headers: { Authorization: "Bearer local-e2e-token" },
      data: { themeMode: theme },
    });
    await page.goto("/add");
    await page
      .getByRole("button", { name: "Edit Running", exact: true })
      .click();
    const editor = page.getByTestId("activity-editor");
    await expect(
      editor.getByRole("textbox", { name: "Emoji", exact: true }),
    ).toHaveValue("🏃");
    await expect(
      editor.getByRole("textbox", { name: "Color", exact: true }),
    ).toHaveCount(0);
    await page.waitForTimeout(400);
    await page.waitForTimeout(400);
    await page.screenshot({
      path: `test-results/activity-editor-${theme}.png`,
    });
    await editor
      .getByRole("button", { name: "Activity Color", exact: true })
      .click();
    await editor
      .getByRole("button", { name: "Automatic (based on plan)", exact: true })
      .click();
    await page.waitForTimeout(400);
    await page.waitForTimeout(400);
    await page.screenshot({
      path: `test-results/activity-editor-colors-${theme}.png`,
    });
    await editor
      .getByRole("button", { name: "Activity Color", exact: true })
      .click();
    await editor
      .getByRole("textbox", { name: "Activity Title", exact: true })
      .fill("Morning run");
    await request.post(`${API}/__fail`, {
      data: { path: "/activities/upsert" },
    });
    await editor
      .getByRole("button", { name: "Save Activity", exact: true })
      .click();
    await expect(
      editor.getByText("Simulated network failure. Please try again."),
    ).toBeVisible();
    await expect(
      editor.getByRole("textbox", { name: "Activity Title", exact: true }),
    ).toHaveValue("Morning run");
    await editor
      .getByRole("button", { name: "Save Activity", exact: true })
      .click();
    await expect(editor).toBeHidden();
    const state = await (await request.get(`${API}/__state`)).json();
    expect(
      state.activities.find((a: { id: string }) => a.id === "run"),
    ).toMatchObject({
      title: "Morning run",
      colorHex: null,
      emoji: "🏃",
      measure: "kilometers",
    });
  });
}

test("measure conversion is a separate confirmation with a preview", async ({
  page,
  request,
}) => {
  await request.post(`${API}/__reset`);
  await page.goto("/add");
  await page.getByRole("button", { name: "Edit Running", exact: true }).click();
  const editor = page.getByTestId("activity-editor");
  await editor
    .getByRole("textbox", { name: "Measure", exact: true })
    .fill("meters");
  await expect(
    editor.getByRole("textbox", { name: "Conversion factor", exact: true }),
  ).toHaveCount(0);
  await editor
    .getByRole("button", { name: "Save Activity", exact: true })
    .click();
  await expect(
    editor.getByText("Change Activity Measure", { exact: true }),
  ).toBeVisible();
  await editor
    .getByRole("textbox", { name: "Conversion factor", exact: true })
    .fill("0");
  await expect(
    editor.getByRole("button", { name: "Change Measure", exact: true }),
  ).toBeDisabled();
  await editor.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    editor.getByRole("textbox", { name: "Measure", exact: true }),
  ).toHaveValue("meters");
  let state = await (await request.get(`${API}/__state`)).json();
  expect(
    state.requests.filter(
      (r: { path: string }) => r.path === "/activities/upsert",
    ),
  ).toHaveLength(0);
  await editor
    .getByRole("button", { name: "Save Activity", exact: true })
    .click();
  await editor.getByRole("button", { name: "÷", exact: true }).click();
  await editor
    .getByRole("textbox", { name: "Conversion factor", exact: true })
    .fill("1000");
  await expect(
    editor.getByText("60 kilometers = 60000 meters", { exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({
    path: "test-results/activity-editor-conversion.png",
  });
  await editor
    .getByRole("button", { name: "Change Measure", exact: true })
    .click();
  await expect(editor).toBeHidden();
  state = await (await request.get(`${API}/__state`)).json();
  expect(
    state.requests.find(
      (r: { path: string }) => r.path === "/activities/upsert",
    ).body.measureConversion,
  ).toEqual({ operator: "multiply", factor: 1000 });
});

test("delete confirmation explains consequences and cancel preserves edits", async ({
  page,
  request,
}) => {
  await request.post(`${API}/__reset`);
  await page.goto("/add");
  await page.getByRole("button", { name: "Edit Running", exact: true }).click();
  const editor = page.getByTestId("activity-editor");
  await editor
    .getByRole("textbox", { name: "Activity Title", exact: true })
    .fill("Unsaved title");
  await editor
    .getByRole("button", { name: "Delete Activity", exact: true })
    .click();
  await expect(
    editor.getByText(
      "This will permanently delete all entries, reactions, and comments associated with it.",
    ),
  ).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: "test-results/activity-editor-delete.png" });
  await editor.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    editor.getByRole("textbox", { name: "Activity Title", exact: true }),
  ).toHaveValue("Unsaved title");
  const state = await (await request.get(`${API}/__state`)).json();
  expect(
    state.requests.filter((r: { method: string }) => r.method === "DELETE"),
  ).toHaveLength(0);
});

test("confirmed deletion uses the delete endpoint and preserves failures for retry", async ({
  page,
  request,
}) => {
  await request.post(`${API}/__reset`);
  await page.goto("/add");
  await page.getByRole("button", { name: "Edit Running", exact: true }).click();
  const editor = page.getByTestId("activity-editor");
  await editor
    .getByRole("button", { name: "Delete Activity", exact: true })
    .click();
  let attempts = 0;
  await page.route("**/activities/run", async (route) => {
    expect(route.request().method()).toBe("DELETE");
    attempts++;
    await route.fulfill(
      attempts === 1
        ? { status: 503, json: { error: "Delete unavailable. Try again." } }
        : { status: 204 },
    );
  });
  await editor.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(
    editor.getByText("Delete unavailable. Try again."),
  ).toBeVisible();
  await editor.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(editor).toBeHidden();
  expect(attempts).toBe(2);
});

test("new activities still require emoji, title and measure", async ({
  page,
  request,
}) => {
  await request.post(`${API}/__reset`);
  await page.goto("/add");
  await page.getByRole("button", { name: "Add New", exact: true }).click();
  const editor = page.getByTestId("activity-editor");
  await expect(
    editor.getByRole("button", { name: "Delete Activity", exact: true }),
  ).toHaveCount(0);
  await editor
    .getByRole("button", { name: "Save Activity", exact: true })
    .click();
  await expect(
    editor.getByText("Title, measure, and a single emoji are required."),
  ).toBeVisible();
  await editor.getByRole("textbox", { name: "Emoji", exact: true }).fill("🏊");
  await editor
    .getByRole("textbox", { name: "Activity Title", exact: true })
    .fill("Swimming");
  await editor
    .getByRole("textbox", { name: "Measure", exact: true })
    .fill("minutes");
  await editor
    .getByRole("button", { name: "Save Activity", exact: true })
    .click();
  await expect(editor).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Log Swimming", exact: true }),
  ).toBeVisible();
});
