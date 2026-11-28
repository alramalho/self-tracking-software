import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const API = `http://127.0.0.1:${process.env.E2E_API_PORT || "4317"}`;
const output = path.resolve(process.env.SCREENSHOT_DIR || "../../docs/reviews/notifications");

for (const theme of ["LIGHT", "DARK"]) {
  test(`notifications read as avatar rows under New and Earlier in ${theme}`, async ({ page, request }) => {
    test.setTimeout(120000);
    await request.post(`${API}/__reset`);
    await request.patch(`${API}/users/user`, {
      headers: { Authorization: "Bearer local-e2e-token" },
      data: { themeMode: theme },
    });
    await request.post(`${API}/__notifications`);

    await page.goto("/notifications");
    await expect(page.getByRole("heading", { name: "New" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Earlier" })).toBeVisible();
    // No per-row buttons: the row itself opens, and opening the list marks it seen.
    await expect(page.getByText("Mark as read")).toHaveCount(0);
    await expect(page.getByText("Dismissed notice")).toHaveCount(0);
    await expect.poll(async () => {
      const state = await (await request.get(`${API}/__state`)).json();
      return state.requests.find((r: any) => r.path === "/notifications/mark-notifications-opened")?.body.notification_ids;
    }).toEqual(["n-reaction", "n-photo"]);

    mkdirSync(output, { recursive: true });
    await page.screenshot({ path: path.join(output, `notifications-${theme}.png`) });

    await page.getByRole("button", { name: /^@liocas reacted to your activity 🚀/ }).click();
    await expect(page).toHaveURL(/activityEntryId=friend-entry/);
  });
}

test("an empty inbox says you're all caught up", async ({ page, request }) => {
  await request.post(`${API}/__reset`);
  await page.goto("/notifications");
  await expect(page.getByText("You're all caught up")).toBeVisible();
});
