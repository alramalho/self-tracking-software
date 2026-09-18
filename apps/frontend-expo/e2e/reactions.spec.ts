import { test, expect } from "@playwright/test";
const API = "http://127.0.0.1:4317";

for (const theme of ["DARK", "LIGHT"]) {
  test(`reaction island stays anchored and adds/removes the joint reaction in ${theme}`, async ({
    page,
    request,
  }) => {
    await request.post(`${API}/__reset`);
    await request.patch(`${API}/users/user`, {
      headers: { Authorization: "Bearer local-e2e-token" },
      data: { themeMode: theme },
    });
    await request.post(`${API}/__timeline-design`);
    await page.goto("/?activityEntryId=joint-b");
    const card = page.getByTestId("feed-card");
    const trigger = card.getByRole("button", { name: "React", exact: true });
    await trigger.scrollIntoViewIfNeeded();
    const before = await trigger.boundingBox();
    await trigger.click();
    const picker = page.getByTestId("reaction-picker");
    await expect(picker).toBeVisible();
    await expect(picker.getByRole("button")).toHaveText([
      "🔥",
      "🚀",
      "♥️",
      "😂",
      "😮‍💨",
      "🍑",
      "😮",
    ]);
    const island = (await picker.boundingBox())!;
    expect(island.height).toBe(48);
    expect(island.width).toBe(244);
    expect(island.y + island.height).toBeLessThanOrEqual(before!.y);
    expect(
      Math.abs(island.x + island.width - before!.x - before!.width),
    ).toBeLessThan(2);
    expect(island.x).toBeGreaterThanOrEqual(8);
    await page.screenshot({
      path: `test-results/reaction-island-${theme.toLowerCase()}.png`,
    });
    await page
      .getByTestId("reaction-picker-backdrop")
      .click({ position: { x: 8, y: 8 } });
    await expect(picker).not.toBeVisible();
    let state = await (await request.get(`${API}/__state`)).json();
    expect(
      state.requests.filter((r: any) => r.path.endsWith("modify-reactions")),
    ).toHaveLength(0);
    await trigger.click();
    await picker.getByRole("button", { name: "🔥", exact: true }).click();
    await expect(picker).not.toBeVisible();
    await expect(
      card.getByRole("button", { name: "🔥 1", exact: true }),
    ).toBeVisible();
    await trigger.click();
    await picker.getByRole("button", { name: "🔥", exact: true }).click();
    await expect(picker).not.toBeVisible();
    await expect(
      card.getByRole("button", { name: "🔥 1", exact: true }),
    ).not.toBeVisible();
    state = await (await request.get(`${API}/__state`)).json();
    const mutations = state.requests.filter((r: any) =>
      r.path.endsWith("modify-reactions"),
    );
    expect(mutations.map((r: any) => r.path)).toEqual([
      "/activities/activity-entries/joint-b/modify-reactions",
      "/activities/activity-entries/joint-b/modify-reactions",
    ]);
    expect(mutations.map((r: any) => r.body.reactions[0].operation)).toEqual([
      "add",
      "remove",
    ]);
  });
}

test("narrow picker stays on screen and retries a failed reaction without a drawer", async ({
  page,
  request,
}) => {
  await request.post(`${API}/__reset`);
  await request.post(`${API}/__timeline-design`);
  await page.setViewportSize({ width: 260, height: 844 });
  await page.goto("/?activityEntryId=joint-b");
  const trigger = page.getByRole("button", { name: "React", exact: true });
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  const picker = page.getByTestId("reaction-picker");
  await expect(picker).toBeVisible();
  const bounds = (await picker.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(8);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(252);
  await page.route(
    "**/activities/activity-entries/joint-b/modify-reactions",
    (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ message: "Please try again" }),
      }),
    { times: 1 },
  );
  await picker.getByRole("button", { name: "🔥", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ visible: true }).last(),
  ).toBeVisible();
  await expect(picker).toBeVisible();
  await picker.getByRole("button", { name: "🔥", exact: true }).click();
  await expect(picker).not.toBeVisible();
  await trigger.click();
  await expect(picker).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(picker).not.toBeVisible();
});
