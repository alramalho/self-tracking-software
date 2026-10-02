import { test, expect } from "@playwright/test";
import path from "node:path";
const screenshots = path.resolve(
  __dirname,
  "../../../docs/reviews/widgets/screens",
);
test("original PWA cards preserve coach, logging and plan actions in both themes", async ({
  page,
}) => {
  for (const theme of ["light", "dark"]) {
    await page.goto(`/e2e/widgets/?theme=${theme}`);
    await expect(page.getByText("Exercise regularly", { exact: true })).toBeVisible();
    await expect(page.getByText("Week recap available!", { exact: true })).toBeVisible();
    await expect(
      page.getByText("No upcoming sessions. The coach can plan the next week."),
    ).toBeVisible();
    await expect(page.locator("html")).toHaveClass(
      theme === "dark" ? "dark" : "",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await page.screenshot({
      path: path.join(screenshots, `original-pwa-home-${theme}.png`),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Log", exact: true })
      .click();
    await expect(page.getByText("Check-in action received", { exact: true })).toHaveText(
      "Check-in action received",
    );
    const upcoming = page.getByRole("button", { name: /^Upcoming sessions/ });
    await upcoming.click();
    await expect(upcoming).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByText("Next 7 days", { exact: true })).toBeVisible();
    await upcoming.click();
    await expect(upcoming).toHaveAttribute("aria-expanded", "false");
    await page.getByText("Week recap available!", { exact: true }).click();
    await expect(page.getByTestId("fixture-navigation")).toHaveText(
      "/message-ai",
    );
    await page.getByText("Exercise regularly", { exact: true }).click();
    await expect(page.getByTestId("fixture-navigation")).toHaveText(
      "/plans?selectedPlan=fitness",
    );
  }
});
