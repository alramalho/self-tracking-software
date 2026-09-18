import { test, expect } from "@playwright/test";
import { subDays } from "date-fns";
const API = "http://127.0.0.1:4317";
for (const theme of ["DARK", "LIGHT"]) {
  test(`logging drawer matches the calendar layout and preserves date/quantity in ${theme}`, async ({
    page,
    request,
  }) => {
    await request.post(`${API}/__reset`);
    await request.patch(`${API}/users/user`, {
      headers: { Authorization: "Bearer local-e2e-token" },
      data: { themeMode: theme, themeBaseColor: "AMBER" },
    });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/add");
    await page
      .getByRole("button", { name: "Log Running", exact: true })
      .click();
    const drawer = page.getByTestId("activity-logging-drawer");
    await expect(
      drawer.getByRole("heading", { name: "Log Running" }),
    ).toBeVisible();
    await expect(page.getByTestId("logging-calendar")).toBeVisible();
    await expect(drawer).toHaveCSS("border-top-left-radius", "28px");
    await expect(drawer).toHaveCSS(
      "background-color",
      theme === "DARK" ? "rgb(28, 28, 28)" : "rgb(242, 242, 242)",
    );
    await expect(
      drawer.getByRole("button", { name: "Log Activity", exact: true }),
    ).toBeDisabled();
    await page.waitForTimeout(400); // Let the native-style modal entrance finish before visual comparison.
    await page.screenshot({ path: `test-results/logger-${theme}.png` });
    await page
      .getByRole("button", { name: "Set quantity to 45", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Increase quantity", exact: true })
      .click();
    await expect(page.getByLabel("Quantity", { exact: true })).toHaveValue(
      "46",
    );
    await page
      .getByRole("button", { name: "Decrease quantity", exact: true })
      .click();
    const yesterday = subDays(new Date(), 1);
    // Tests run with the phone's Berlin timezone; noon avoids local midnight ambiguity.
    const dateLabel = new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Berlin",
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(yesterday);
    if (
      yesterday.getDate() ===
      new Date(yesterday.getFullYear(), yesterday.getMonth() + 1, 0).getDate()
    )
      await page
        .getByRole("button", { name: "Previous month", exact: true })
        .click();
    await page.getByRole("button", { name: dateLabel, exact: true }).click();
    await page.getByRole("button", { name: "Edit time", exact: true }).click();
    await page.getByLabel("Hours", { exact: true }).fill("12");
    await page.getByLabel("Minutes", { exact: true }).fill("15");
    await page
      .getByRole("button", { name: "Done editing time", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Log Activity", exact: true })
      .click();
    await page
      .getByLabel("Caption (optional)", { exact: true })
      .fill(`Calendar log ${theme}`);
    await page.getByRole("button", { name: "More options", exact: true }).click();
    await page
      .getByRole("button", { name: "With a friend (optional)", exact: true })
      .click();
    await page.getByRole("button", { name: "With Sam", exact: true }).click();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(page.getByLabel("Quantity", { exact: true })).toHaveValue(
      "45",
    );
    await expect(page.getByText("at 12:15", { exact: true })).toBeVisible();
    await page
      .getByRole("button", { name: "Log Activity", exact: true })
      .click();
    await page.getByRole("button", { name: "More options", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "With Sam", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Log without photo", exact: true })
      .click();
    await page.getByRole("button", { name: "Skip", exact: true }).click();
    await page.getByRole("button", { name: "Done", exact: true }).click();
    const state = await (await request.get(`${API}/__state`)).json();
    const log = state.requests.find(
      (r: any) => r.path === "/activities/log-activity",
    );
    expect(Number(log.body.quantity)).toBe(45);
    expect(log.body.withUserId).toBe("sam");
    expect(log.body.timezone).toBe("Europe/Berlin");
    expect(
      new Date(log.body.iso_date_string).toLocaleString("en-GB", {
        timeZone: "Europe/Berlin",
        hour: "2-digit",
        minute: "2-digit",
      }),
    ).toBe("12:15");
    await page
      .getByRole("button", { name: "Log Running", exact: true })
      .click();
    await drawer.getByRole("button", { name: "Close", exact: true }).click();
    await expect(drawer).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}
