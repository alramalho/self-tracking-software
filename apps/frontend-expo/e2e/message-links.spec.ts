import { test, expect } from "@playwright/test";
test("coach plan and activity references render as native links", async ({ page, request }) => {
  await request.post("http://127.0.0.1:4317/__reset");
  await page.route("**/chats/coach-main/messages?includeCoachHistory=true", async route => {
    const response = await route.fetch(); const data = await response.json();
    data.messages.push({ id: "entities", chatId: "coach-main", role: "COACH", content: "Review {{plan:fitness|Your fitness plan}} and {{activity:run|Your running activity}}.", createdAt: new Date().toISOString() });
    await route.fulfill({ response, json: data });
  });
  await page.goto("/chat/coach-main");
  await page.getByRole("link", { name: "Your running activity" }).click();
  await expect(page.getByText("kilometers", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close Activity", exact: true }).click();
  await page.getByRole("link", { name: "Your fitness plan" }).click();
  await page.getByRole("button", { name: "View full plan", exact: true }).click();
  await expect(page).toHaveURL(/\/plan\/fitness/);
  await expect(page.getByText("Exercise regularly", { exact: true }).first()).toBeVisible();
});
