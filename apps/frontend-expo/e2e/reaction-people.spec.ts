import { test, expect } from "@playwright/test";
const API = "http://127.0.0.1:4317";

for (const theme of ["DARK", "LIGHT"]) {
  for (const kind of ["own", "external", "joint"]) {
    test(`reaction viewers and glass badges on ${kind} activity in ${theme}`, async ({
      page,
      request,
    }) => {
      await request.post(`${API}/__reset`);
      await request.patch(`${API}/users/user`, {
        headers: { Authorization: "Bearer local-e2e-token" },
        data: { themeMode: theme },
      });
      await request.post(`${API}/__timeline-design`);
      await request.post(`${API}/__reaction-people`, { data: { kind } });
      await page.goto(
        `/?activityEntryId=${kind === "own" ? "joint-a" : "joint-b"}`,
      );
      const card = page.getByTestId("feed-card");
      const fire = card.getByRole("button", { name: "🔥 1", exact: true });
      await fire.scrollIntoViewIfNeeded();
      await expect(fire).toHaveCSS("backdrop-filter", "blur(12px)");
      await expect(fire).toHaveCSS(
        "background-color",
        theme === "DARK"
          ? "rgba(255, 255, 255, 0.08)"
          : "rgba(255, 255, 255, 0.22)",
      );
      await expect(
        card.getByRole("button", { name: "♥️ 1", exact: true }),
      ).toHaveCSS("background-color", "rgba(245, 158, 11, 0.22)");
      await fire.click();
      const popup = page.getByTestId("reaction-people");
      await expect(popup).toBeVisible();
      await expect(
        popup.getByRole("button", { name: "View @sam's profile", exact: true }),
      ).toBeVisible();
      await expect(
        popup.getByRole("button", {
          name: "View @alex's profile",
          exact: true,
        }),
      ).not.toBeVisible();
      await popup.getByRole("button", { name: "Show all reactions" }).click();
      await expect(
        popup.getByRole("button", {
          name: "View @alex's profile",
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        popup.getByRole("button", { name: "View @sam's profile", exact: true }),
      ).toHaveCount(1);
      const bounds = (await popup.boundingBox())!;
      expect(bounds.width).toBe(300);
      expect(bounds.x).toBeGreaterThanOrEqual(8);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(844);
      await page.screenshot({
        path: `test-results/reaction-people-${kind}-${theme}.png`,
      });
      await popup
        .getByRole("button", { name: "Close reaction people" })
        .click();
      await expect(popup).not.toBeVisible();
      await fire.click();
      await expect(popup).toBeVisible();
      await page
        .getByTestId("reaction-people-backdrop")
        .click({ position: { x: 2, y: 2 } });
      await expect(popup).not.toBeVisible();
      await fire.click();
      await popup
        .getByRole("button", { name: "View @sam's profile", exact: true })
        .click();
      await expect(page).toHaveURL(/\/profile\/sam/);
      const state = await (await request.get(`${API}/__state`)).json();
      expect(
        state.requests.filter((r: any) => r.path.endsWith("modify-reactions")),
      ).toHaveLength(0);
    });
  }
}

test("many reactors scroll on a small screen, including non-photo activity", async ({
  page,
  request,
}) => {
  await request.post(`${API}/__reset`);
  await request.post(`${API}/__timeline-design`);
  await request.post(`${API}/__reaction-people`, {
    data: { kind: "external", photos: false, many: true },
  });
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/?activityEntryId=joint-b");
  await page.getByRole("button", { name: "🔥 11", exact: true }).click();
  const popup = page.getByTestId("reaction-people");
  await expect(popup).toBeVisible();
  const last = popup.getByRole("button", {
    name: "View @person9's profile",
    exact: true,
  });
  await last.scrollIntoViewIfNeeded();
  await expect(last).toBeInViewport();
  await page.keyboard.press("Escape");
  await expect(popup).not.toBeVisible();
});
