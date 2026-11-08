import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const API = `http://127.0.0.1:${process.env.E2E_API_PORT || "4317"}`;
const output = path.resolve(process.env.SCREENSHOT_DIR || "../../docs/reviews/home-progress");

for (const theme of ["LIGHT", "DARK"]) {
  test(`the Soon card sums up each plan under the selected day, in ${theme}`, async ({ page, request }) => {
    test.setTimeout(120000);
    await request.post(`${API}/__reset`);
    await request.post(`${API}/__home-todo`, { data: { theme, withoutCoachNote: true } });

    await page.goto("/");
    const summary = page.getByTestId("home-progress");
    await expect(summary).toBeVisible();
    await expect(summary.getByRole("button")).toHaveCount(2);
    // It sits under the selected day's card, and stays short.
    const box = await summary.boundingBox();
    const dayBox = await page.getByTestId("home-day-detail").boundingBox();
    expect(box!.y).toBeGreaterThan(dayBox!.y + dayBox!.height);
    expect(box!.height).toBeLessThan(60);

    mkdirSync(output, { recursive: true });
    await summary.evaluate((el) => el.scrollIntoView({ block: "center" }));
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(output, `soon-${theme.toLowerCase()}.png`) });
  });
}
