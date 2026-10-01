import { expect, test } from "@playwright/test";

const API = `http://127.0.0.1:${process.env.E2E_API_PORT || "4317"}`;

// A native sheet dims the screen in place and slides only the sheet. The dim used to ride up
// with the sheet, showing its top edge as a dark stripe on the way.
test("the settings drawer slides up while its dim stays put, and slides away on close", async ({ page, request }) => {
  await request.post(`${API}/__reset`);
  await page.goto("/settings");
  const dim = page.getByLabel("Dismiss settings");
  const drawer = page.getByTestId("settings-drawer");
  await dim.waitFor({ state: "attached" });
  const viewport = page.viewportSize()!;
  // From the first frame the dim covers the whole screen.
  const early = await dim.boundingBox();
  expect(early).toMatchObject({ x: 0, y: 0, width: viewport.width, height: viewport.height });
  const start = (await drawer.boundingBox())!;
  await expect(page.getByRole("button", { name: "User Settings", exact: true })).toBeVisible();
  await page.waitForTimeout(600);
  const rest = (await drawer.boundingBox())!;
  // The sheet came up from below and now rests on the bottom edge.
  expect(start.y).toBeGreaterThan(rest.y);
  expect(Math.round(rest.y + rest.height)).toBe(viewport.height);
  expect(await dim.boundingBox()).toMatchObject({ y: 0, height: viewport.height });

  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(drawer).toHaveCount(0);
});
