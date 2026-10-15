import { test, expect, type Page } from "@playwright/test";
const API = `http://127.0.0.1:${process.env.E2E_API_PORT || "4317"}`;

async function setup(page: Page, request: any, theme: string, hikingMeasure?: string) {
  await request.post(`${API}/__reset`);
  const headers = { Authorization: "Bearer local-e2e-token" };
  await request.post(`${API}/__duplicate-activities`, { headers, data: { hikingMeasure } });
  await request.patch(`${API}/users/user`, { headers, data: { themeMode: theme } });
  await page.goto("/add");
}

async function shot(page: Page, name: string) {
  await page.waitForTimeout(500);
  await page.screenshot({ path: `test-results/activity-merge/${name}.png` });
}

async function fillNew(page: Page, emoji: string, title: string) {
  await page.getByRole("button", { name: "Add New", exact: true }).click();
  const editor = page.getByTestId("activity-editor");
  await editor.getByRole("textbox", { name: "Emoji", exact: true }).fill(emoji);
  await editor.getByRole("textbox", { name: "Activity Title", exact: true }).fill(title);
  await editor.getByRole("textbox", { name: "Measure", exact: true }).fill("minutes");
  return editor;
}

for (const theme of ["DARK", "LIGHT"]) {
  test(`typing a name you already have offers the existing activity (${theme})`, async ({ page, request }) => {
    await setup(page, request, theme);
    const editor = await fillNew(page, "🥾", "hiking");
    const hint = editor.getByTestId("activity-duplicate-hint");
    await expect(hint).toContainText("You already have");
    await expect(hint).toContainText("Hike");
    await shot(page, `1-create-hint-${theme}`);

    await hint.click();
    await expect(editor).toBeHidden();
    // Opens the logger for Hike instead of creating a second activity.
    await expect(page.getByText("Hike", { exact: false }).first()).toBeVisible();
    await shot(page, `2-use-existing-${theme}`);
    const state = await (await request.get(`${API}/__state`)).json();
    expect(state.activities.filter((a: any) => /hik/i.test(a.title))).toHaveLength(2);
  });

  test(`after saving, Jev's match offers a merge (${theme})`, async ({ page, request }) => {
    await setup(page, request, theme);
    const editor = await fillNew(page, "🌲", "Trail walk");
    await expect(editor.getByTestId("activity-duplicate-hint")).toHaveCount(0);
    await editor.getByRole("button", { name: "Save Activity", exact: true }).click();
    await expect(editor.getByText("Same Activity?", { exact: true })).toBeVisible();
    await expect(editor.getByText("Trail walk looks like the same activity as Hike.")).toBeVisible();
    await shot(page, `3-after-save-${theme}`);

    await editor.getByRole("button", { name: "Merge into Hike", exact: true }).click();
    await expect(editor).toBeHidden();
    const state = await (await request.get(`${API}/__state`)).json();
    expect(state.activities.map((a: any) => a.title)).not.toContain("Trail walk");
  });

  test(`hours convert into minutes when merging (${theme})`, async ({ page, request }) => {
    await setup(page, request, theme, "hours");
    await page.getByRole("button", { name: "Edit Hiking", exact: true }).click();
    const editor = page.getByTestId("activity-editor");
    await editor.getByTestId("activity-duplicate-hint").click();
    await expect(editor.getByText("1 hour = 60 minutes", { exact: true })).toBeVisible();
    await shot(page, `7-merge-convert-${theme}`);

    await editor.getByRole("button", { name: "Merge into Hike", exact: true }).click();
    await expect(editor).toBeHidden();
    const state = await (await request.get(`${API}/__state`)).json();
    // Hiking's 2-hour logs arrive in Hike as 120 minutes.
    expect(
      state.entries.filter((e: any) => e.activityId === "hike").map((e: any) => e.quantity).sort(),
    ).toEqual([120, 120, 90, 90, 90, 90].sort());
  });

  test(`editing an old duplicate offers to merge it (${theme})`, async ({ page, request }) => {
    await setup(page, request, theme);
    await page.getByRole("button", { name: "Edit Hiking", exact: true }).click();
    const editor = page.getByTestId("activity-editor");
    const hint = editor.getByTestId("activity-duplicate-hint");
    await expect(hint).toContainText("Same as");
    await expect(hint).toContainText("Hike");
    await shot(page, `4-edit-hint-${theme}`);

    await hint.click();
    await expect(editor.getByText("2 logs · 1 plan", { exact: true })).toBeVisible();
    await shot(page, `5-merge-confirm-${theme}`);

    await editor.getByRole("button", { name: "Merge into Hike", exact: true }).click();
    await expect(editor).toBeHidden();
    await expect(page.getByRole("button", { name: "Edit Hiking", exact: true })).toHaveCount(0);
    await shot(page, `6-merged-list-${theme}`);
    const state = await (await request.get(`${API}/__state`)).json();
    expect(state.entries.filter((e: any) => e.activityId === "hike")).toHaveLength(6);
  });
}

test("keep both leaves the new activity in place", async ({ page, request }) => {
  await setup(page, request, "DARK");
  const editor = await fillNew(page, "🌲", "Trail walk");
  await editor.getByRole("button", { name: "Save Activity", exact: true }).click();
  await editor.getByRole("button", { name: "Keep Both", exact: true }).click();
  await expect(editor).toBeHidden();
  const state = await (await request.get(`${API}/__state`)).json();
  expect(state.activities.map((a: any) => a.title)).toContain("Trail walk");
  expect(state.requests.filter((r: any) => r.path.endsWith("/merge"))).toHaveLength(0);
});
