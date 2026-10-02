import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

const screenshots = path.resolve(
  __dirname,
  "../../../docs/reviews/widgets/screens",
);
const api = "http://127.0.0.1:4316";
const headers = { Authorization: "Bearer local-e2e-token" };
test("widget check-in link opens the logger and can be dismissed", async ({
  page,
  request,
}) => {
  await request.post(`${api}/__reset`);
  await page.goto("/metrics?checkin=1", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByText("Log Your Metrics", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await expect(
    page.getByText("Log Your Metrics", { exact: true }),
  ).not.toBeVisible();
  await expect(page).not.toHaveURL(/checkin=1/);
});
test("homepage reference and widget destinations in both themes", async ({
  page,
  request,
}) => {
  test.setTimeout(90000);
  fs.mkdirSync(screenshots, { recursive: true });
  for (const theme of ["LIGHT", "DARK"]) {
    await request.post(`${api}/__reset`);
    expect(
      (
        await request.post(`${api}/__follow-through`, { headers, data: {} })
      ).ok(),
    ).toBeTruthy();
    expect(
      (
        await request.patch(`${api}/users/user`, {
          headers,
          data: { themeMode: theme },
        })
      ).ok(),
    ).toBeTruthy();
    // The app persists query data. Each appearance starts from a fresh account cache.
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => localStorage.clear());
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("button", { name: "Open Exercise regularly" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Coach quick check" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Log", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: path.join(screenshots, `home-${theme.toLowerCase()}.png`),
    });
    await page.getByRole("button", { name: "Coach quick check" }).click();
    await expect(
      page
        .getByTestId("follow-through-overview")
        .getByText("Did your running session happen?", { exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: path.join(
        screenshots,
        `destination-coach-${theme.toLowerCase()}.png`,
      ),
    });
    await page.getByRole("button", { name: "Not now", exact: true }).click();
    await page
      .getByRole("button", { name: "Log", exact: true })
      .click();
    await expect(
      page.getByText("Log Your Metrics", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Skip", exact: true }).click();
    await page.goto("/plans?selectedPlan=fitness", {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByText("Exercise regularly").first()).toBeVisible();
    await page.screenshot({
      path: path.join(
        screenshots,
        `destination-plan-${theme.toLowerCase()}.png`,
      ),
    });
    await page.goto("/metrics?checkin=1", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByText("Log Your Metrics", { exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: path.join(
        screenshots,
        `destination-metrics-${theme.toLowerCase()}.png`,
      ),
    });
    await page.goto("/session/session-check", {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByText(/Exercise regularly/).first()).toBeVisible();
    await page.screenshot({
      path: path.join(
        screenshots,
        `destination-session-${theme.toLowerCase()}.png`,
      ),
    });
  }
});
