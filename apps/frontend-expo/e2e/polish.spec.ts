import { test, expect } from "@playwright/test";
const API = "http://127.0.0.1:4317";
for (const theme of ["DARK", "LIGHT"])
  test(`plan islands, notes editing and metrics fidelity in ${theme}`, async ({
    page,
    request,
  }) => {
    await request.post(`${API}/__reset`);
    await request.post(`${API}/__polish`, { data: { theme } });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/plans?selectedPlan=fitness");
    await page.getByRole("button", { name: "Plan notes", exact: true }).click();
    const notes = page.getByTestId("plan-notes-island");
    await notes.scrollIntoViewIfNeeded();
    await expect(page.getByTestId("reveal-plan-notes-fitness")).toHaveCSS(
      "opacity",
      "1",
    );
    await expect(notes.getByText("Training roadmap")).toBeVisible();
    await expect(page.getByTestId("plan-card")).toHaveCSS(
      "background-color",
      "rgba(0, 0, 0, 0)",
    );
    await expect(notes).toHaveCSS("border-radius", "16px");
    await expect(notes).toHaveCSS(
      "border-top-color",
      theme === "DARK" ? "rgb(26, 26, 26)" : "rgb(228, 228, 231)",
    );
    await expect(notes.getByText("consistency", { exact: true })).toHaveCSS(
      "font-family",
      "Inter-SemiBold",
    );
    await expect(
      notes.getByRole("link", { name: "Training guide" }),
    ).toBeVisible();
    await page.screenshot({
      path: `test-results/plan-notes-polish-${theme}.png`,
    });
    await notes
      .getByRole("button", { name: "Edit plan notes", exact: true })
      .click();
    await notes
      .getByRole("textbox", { name: "Plan notes", exact: true })
      .fill("## Updated roadmap\n**Preview works**");
    await expect(notes.getByText("PREVIEW", { exact: true })).toBeVisible();
    await notes.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(notes.getByText("Training roadmap")).toBeVisible();
    await notes
      .getByRole("button", { name: "Edit plan notes", exact: true })
      .click();
    await notes
      .getByRole("textbox", { name: "Plan notes", exact: true })
      .fill("## Saved roadmap\nKeep **showing up**");
    await request.post(`${API}/__fail`, {
      data: { path: "/plans/upsert" },
    });
    await notes.getByRole("button", { name: "Save", exact: true }).click();
    await expect(notes.getByRole("alert")).toBeVisible();
    await expect(
      notes.getByRole("textbox", { name: "Plan notes", exact: true }),
    ).toHaveValue("## Saved roadmap\nKeep **showing up**");
    await notes.getByRole("button", { name: "Save", exact: true }).click();
    await expect(notes.getByRole("textbox")).toHaveCount(0);
    await expect(
      notes.getByText("Saved roadmap", { exact: true }),
    ).toBeVisible();
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
    await expect(insights.getByText("Energy Insights")).toBeVisible();
    for (const label of ["Confident", "Medium", "Weak", "Insufficient"])
      await expect(insights.getByText(label, { exact: true })).toBeVisible();
    await expect(page.getByTestId("correlation-polish-3")).toHaveCSS(
      "opacity",
      "0.4",
    );
    await expect(insights.getByRole("progressbar").first()).toHaveCSS(
      "height",
      "12px",
    );
    await expect(insights).toHaveCSS("border-radius", "16px");
    await page.screenshot({
      path: `test-results/metric-insights-polish-${theme}.png`,
    });
    await insights
      .getByRole("button", { name: "Sauna reliability: Insufficient" })
      .click();
    await expect(page.getByText("Current Data Points: 2")).toBeVisible();
    await expect(
      page.getByText("Log 3 more times to reach Weak reliability"),
    ).toBeVisible();
    await page.getByRole("button", { name: "Close", exact: true }).click();
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
  const reveal = page.getByTestId("reveal-metrics-insights-energy");
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
