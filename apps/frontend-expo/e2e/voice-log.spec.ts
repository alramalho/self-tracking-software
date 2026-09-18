import { expect, test } from "@playwright/test";

const API = "http://127.0.0.1:4317";

for (const theme of ["DARK", "LIGHT"]) {
  test(`voice note entry point stays secondary and opens its review drawer in ${theme}`, async ({
    page,
    request,
  }) => {
    await request.post(`${API}/__reset`);
    await request.patch(`${API}/users/user`, {
      headers: { Authorization: "Bearer local-e2e-token" },
      data: { themeMode: theme, themeBaseColor: "BLUE" },
    });
    await page.goto("/add");

    const card = page.getByTestId("log-voice-note-card");
    await expect(card).toBeVisible();
    await expect(card).toHaveCSS(
      "background-color",
      theme === "DARK" ? "rgb(20, 20, 20)" : "rgb(250, 250, 250)",
    );
    await expect(card.getByText("Log voice note", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Log Running", exact: true }),
    ).toBeVisible();

    await card.click();
    const drawer = page.getByTestId("voice-log-drawer");
    await expect(drawer).toBeVisible();
    await expect(drawer.getByTestId("voice-log-ready")).toBeVisible();
    await expect(drawer.getByText("Private until you save", { exact: true })).toBeVisible();
    await expect(
      drawer.getByText("Nothing is logged automatically.", { exact: false }),
    ).toBeVisible();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `test-results/voice-log-ready-${theme}.png` });

    await drawer.getByRole("button", { name: "Close", exact: true }).click();
    await expect(drawer).toHaveCount(0);
  });
}

test("voice note entry point follows the selected amber theme", async ({
  page,
  request,
}) => {
  await request.post(`${API}/__reset`);
  await request.patch(`${API}/users/user`, {
    headers: { Authorization: "Bearer local-e2e-token" },
    data: { themeMode: "LIGHT", themeBaseColor: "AMBER" },
  });
  await page.goto("/add");

  const card = page.getByTestId("log-voice-note-card");
  await expect(card).toHaveCSS("background-color", "rgb(250, 250, 250)");
  await expect(card).toHaveCSS("border-color", "rgb(228, 228, 231)");
  await page.screenshot({ path: "test-results/voice-log-amber.png" });
});
