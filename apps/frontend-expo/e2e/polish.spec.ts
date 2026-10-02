import { test, expect } from "@playwright/test";
const API = `http://127.0.0.1:${process.env.E2E_API_PORT || "4317"}`;
for (const theme of ["DARK", "LIGHT"])
  test(`plan islands and metrics fidelity in ${theme}`, async ({
    page,
    request,
  }) => {
    await request.post(`${API}/__reset`);
    await request.post(`${API}/__polish`, { data: { theme } });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/plans?selectedPlan=fitness");
    await expect(page.getByTestId("plan-card")).toHaveCSS(
      "background-color",
      "rgba(0, 0, 0, 0)",
    );
    const grid = page.getByTestId("reveal-plan-grid-fitness-true");
    await grid.scrollIntoViewIfNeeded();
    await expect(grid).toHaveCSS("opacity", "1");
    await expect(grid).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await page.screenshot({
      path: `test-results/plan-grid-polish-${theme}.png`,
    });
    await page.getByTestId("nav-metrics").click();
    await page.getByRole("button", { name: "Check-ins", exact: true }).click();
    const insights = page.getByTestId("metric-insights-island");
    await insights.scrollIntoViewIfNeeded();
    await expect(page.getByTestId("reveal-metrics-insights-energy")).toHaveCSS(
      "opacity",
      "1",
    );
    // The coach states the finding before any row.
    await expect(insights.getByText("Helly", { exact: true })).toBeVisible();
    await expect(
      insights.getByText(
        "Your energy tends to be higher on Chess days and lower on Gym days.",
      ),
    ).toBeVisible();
    // Each row: a real difference, and signal strength as zero to three bars.
    for (const label of [
      "🏋️ Gym: −23%, signal 3 of 3",
      "♟️ Chess: +21%, signal 1 of 3",
      "🏃 Running: +3%, signal 2 of 3",
      "🧖 Sauna: 3 more days, signal 0 of 3",
    ])
      await expect(insights.getByRole("button", { name: label })).toBeVisible();
    // Four activities are too early. One shows, and the rest fold into one line
    // until it is tapped, so findings are not buried under one-off activities.
    await expect(insights.getByRole("button", { name: /Yoga/ })).toHaveCount(0);
    await expect(insights.getByRole("button", { name: /Hike/ })).toHaveCount(0);
    await expect(insights.getByRole("button", { name: /Reading/ })).toHaveCount(0);
    // No statistics vocabulary and no tier labels on the screen itself.
    for (const word of [
      "Confident",
      "Medium",
      "Weak",
      "Insufficient",
      /correlation/i,
      /data points/i,
    ])
      await expect(insights.getByText(word)).toHaveCount(0);
    // Too few days: the row is faded and its bar stays empty.
    await expect(page.getByTestId("findings-more")).toHaveText(
      "3 more need more days",
    );
    const sauna = page.getByTestId("finding-polish-3");
    await expect(sauna).toHaveCSS("opacity", "0.45");
    await expect(sauna.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "0",
    );
    // One colour per row: the bar. Red for lower, green for higher, grey when
    // there is no clear difference. The number stays in the text colour.
    const bar = (id: string) =>
      page.getByTestId(id).getByRole("progressbar").locator("div");
    await expect(bar("finding-polish-0")).toHaveCSS(
      "background-color",
      "rgb(239, 68, 68)",
    );
    await expect(bar("finding-polish-2")).toHaveCSS(
      "background-color",
      "rgb(34, 197, 94)",
    );
    await expect(bar("finding-polish-1")).toHaveCSS(
      "background-color",
      "rgb(156, 163, 175)",
    );
    await expect(insights).toHaveCSS("border-radius", "16px");
    // The trend is one line; the averages wait behind a tap.
    const trend = page.getByTestId("metric-trend");
    await expect(
      trend.getByText("A little lower than last week"),
    ).toBeVisible();
    await expect(page.getByText(/avg/i)).toHaveCount(0);
    await page.screenshot({
      path: `test-results/metric-insights-polish-${theme}.png`,
    });
    await page.screenshot({
      path: `test-results/metrics-page-polish-${theme}.png`,
      fullPage: true,
    });
    await page.getByTestId("findings-more").click();
    await expect(page.getByTestId("findings-more")).toHaveCount(0);
    await expect(insights.getByRole("button", { name: /Yoga: 4 more days/ })).toBeVisible();
    await expect(insights.getByRole("button", { name: /Hike: 4 more days/ })).toBeVisible();
    await expect(insights.getByRole("button", { name: /Reading: 4 more days/ })).toBeVisible();
    await sauna.click();
    await expect(
      page.getByText("2 Sauna days with a check-in so far."),
    ).toBeVisible();
    await expect(
      page.getByText("3 more days and this row gets a number."),
    ).toBeVisible();
    await page.getByRole("button", { name: "Close 🧖 Sauna" }).click();
    await page.getByTestId("finding-polish-0").click();
    await expect(
      page.getByText("Energy averages 3.2 on Gym days and 4.2 on other days."),
    ).toBeVisible();
    await expect(
      page.getByText("Based on 38 Gym days and 37 other days."),
    ).toBeVisible();
    await expect(page.getByText("Signal 3 of 3.")).toBeVisible();
    await expect(page.getByText(/It's a pattern, not proof/)).toBeVisible();
    await page.getByRole("button", { name: "Close 🏋️ Gym" }).click();
    await trend.click();
    await expect(page.getByText("This week: 3.6")).toBeVisible();
    await expect(page.getByText("Last week: 3.9")).toBeVisible();
    await page
      .getByRole("button", { name: "Close Energy this week" })
      .click();
    expect(errors).toEqual([]);
  });
test("viewport reveal happens once and reduced motion shows content immediately", async ({
  page,
  request,
}) => {
  await request.post(`${API}/__reset`);
  await request.post(`${API}/__polish`);
  await page.goto("/metrics");
  await page.getByRole("button", { name: "Check-ins", exact: true }).click();
  // The trend card starts below the fold, under the insights card.
  const reveal = page.getByTestId("reveal-metrics-trend-energy");
  await expect(reveal).toHaveCSS("opacity", "0");
  const frames = await reveal.evaluate(
    (element) =>
      new Promise<number[]>((resolve) => {
        const values: number[] = [];
        const start = performance.now();
        element.scrollIntoView({ block: "center" });
        const sample = () => {
          values.push(Number(getComputedStyle(element).opacity));
          if (performance.now() - start < 1100) requestAnimationFrame(sample);
          else resolve(values);
        };
        requestAnimationFrame(sample);
      }),
  );
  expect(frames.some((value) => value > 0 && value < 1)).toBe(true);
  await expect(reveal).toHaveCSS("opacity", "1");
  await page.getByTestId("reveal-metrics-checkins").scrollIntoViewIfNeeded();
  await expect(reveal).toHaveCSS("opacity", "1");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await page.getByRole("button", { name: "Check-ins", exact: true }).click();
  await expect(reveal).toHaveCSS("opacity", "1");
  await expect(reveal).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
});

test("completed plan progress pulses and stops for reduced motion", async ({
  page,
  request,
}) => {
  await request.post(`${API}/__reset`);
  await request.post(`${API}/__polish`);
  await page.goto("/plans?selectedPlan=fitness");
  const progress = page.getByRole("progressbar", {
    name: "Weekly progress",
    exact: true,
  });
  await progress.scrollIntoViewIfNeeded();
  await expect(progress).toHaveAttribute("aria-valuenow", "1");
  const frames = await progress.evaluate(
    (element) =>
      new Promise<number[]>((resolve) => {
        const values: number[] = [];
        const start = performance.now();
        const sample = () => {
          values.push(Number(getComputedStyle(element).opacity));
          if (performance.now() - start < 1800) requestAnimationFrame(sample);
          else resolve(values);
        };
        requestAnimationFrame(sample);
      }),
  );
  expect(Math.max(...frames) - Math.min(...frames)).toBeGreaterThan(0.1);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(progress).toHaveCSS("opacity", "1");
  const stable = await progress.evaluate(
    (element) =>
      new Promise<boolean>((resolve) => {
        let unchanged = true;
        const start = performance.now();
        const sample = () => {
          unchanged = unchanged && getComputedStyle(element).opacity === "1";
          if (performance.now() - start < 500) requestAnimationFrame(sample);
          else resolve(unchanged);
        };
        requestAnimationFrame(sample);
      }),
  );
  expect(stable).toBe(true);
});

for (const theme of ["DARK", "LIGHT"])
  test(`long lifestyle progress shows the exact overflow count in ${theme}`, async ({
    page,
    request,
  }) => {
    await request.post(`${API}/__reset`);
    await request.post(`${API}/__polish`, { data: { theme } });
    await request.post(`${API}/__follow-through`, {
      headers: { Authorization: "Bearer local-e2e-token" },
      data: {},
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/plans?selectedPlan=fitness");

    const progress = page.getByRole("progressbar", {
      name: "Lifestyle progress",
      exact: true,
    });
    await progress.scrollIntoViewIfNeeded();
    await expect(progress).toHaveAttribute("aria-valuenow", "20");
    await expect(progress.getByText("+11", { exact: true })).toBeVisible();
    await page.screenshot({
      path: `test-results/plan-progress-overflow-${theme}.png`,
    });
  });
