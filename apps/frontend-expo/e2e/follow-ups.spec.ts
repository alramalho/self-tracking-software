import { test, expect } from "@playwright/test";
const API = "http://127.0.0.1:4317";
for (const theme of ["DARK", "LIGHT"]) {
  test(`post-log effort and metrics match the PWA flow in ${theme}`, async ({
    page,
    request,
  }) => {
    await request.post(`${API}/__reset`);
    await request.patch(`${API}/users/user`, {
      headers: { Authorization: "Bearer local-e2e-token" },
      data: { themeMode: theme, themeBaseColor: "AMBER" },
    });
    await request.post(`${API}/metrics`, {
      headers: { Authorization: "Bearer local-e2e-token" },
      data: { title: "Productivity", emoji: "📈" },
    });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/add");
    await page
      .getByRole("button", { name: "Log Running", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Set quantity to 45", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Log Activity", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Log without photo", exact: true })
      .click();
    const effort = page.getByTestId("difficulty-follow-up");
    await expect(
      effort.getByRole("heading", { name: "How hard was Running?" }),
    ).toBeVisible();
    await expect(
      effort.getByRole("button", { name: "Done", exact: true }),
    ).toBeDisabled();
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: `test-results/follow-up-effort-${theme}.png`,
    });
    await effort.getByRole("button", { name: "Hard", exact: true }).click();
    await expect(
      effort.getByRole("button", { name: "Done", exact: true }),
    ).toBeEnabled();
    await effort
      .getByRole("button", { name: "Poor sleep", exact: true })
      .click();
    await effort
      .getByRole("button", { name: "Add detail", exact: true })
      .click();
    await effort
      .getByLabel("Private reflection", { exact: true })
      .fill("Late night; recovered afterward.");
    let state = await (await request.get(`${API}/__state`)).json();
    expect(
      state.requests.filter(
        (r: any) => r.method === "PUT" && r.path.includes("/activity-entries/"),
      ),
    ).toHaveLength(0);
    const entry = state.entries.at(-1);
    await request.post(`${API}/__fail`, {
      data: { path: `/activities/activity-entries/${entry.id}` },
    });
    await effort.getByRole("button", { name: "Done", exact: true }).click();
    await expect(
      effort.getByText("Simulated network failure. Please try again."),
    ).toBeVisible();
    await expect(
      effort.getByLabel("Private reflection", { exact: true }),
    ).toHaveValue("Late night; recovered afterward.");
    await effort.getByRole("button", { name: "Done", exact: true }).click();
    const metrics = page.getByTestId("metrics-follow-up");
    await expect(
      metrics.getByRole("heading", { name: "Log Your Metrics" }),
    ).toBeVisible();
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: `test-results/follow-up-metrics-${theme}.png`,
    });
    await expect(
      metrics.getByLabel("Anything to add?", { exact: true }),
    ).toHaveCount(0);
    await metrics
      .getByRole("button", { name: "Energy rating 4", exact: true })
      .click();
    await metrics
      .getByRole("button", { name: "Mood rating 5", exact: true })
      .click();
    await metrics
      .getByRole("button", { name: "Productivity rating 3", exact: true })
      .click();
    await metrics
      .getByLabel("Anything to add?", { exact: true })
      .fill("Feeling better now");
    await page.screenshot({ path: `test-results/follow-up-note-${theme}.png` });
    await request.post(`${API}/__fail`, {
      data: { path: "/metrics/entries/today-note" },
    });
    await metrics.getByRole("button", { name: "Done", exact: true }).click();
    await expect(
      metrics.getByText("Simulated network failure. Please try again."),
    ).toBeVisible();
    await metrics.getByRole("button", { name: "Done", exact: true }).click();
    await expect(
      page.getByText("Activity logged!", { exact: true }),
    ).toBeVisible();
    state = await (await request.get(`${API}/__state`)).json();
    const saved = state.entries.find((e: any) => e.id === entry.id);
    expect(saved.difficulty).toBe("hard");
    expect(saved.privateNotes).toBe(
      "Coach should know: Poor sleep.\nLate night; recovered afterward.",
    );
    expect(
      state.requests.filter(
        (r: any) => r.method === "POST" && r.path === "/metrics/entries",
      ),
    ).toHaveLength(3);
    expect(errors).toEqual([]);
  });
}

test("follow-up drawers stay usable with Reduce Motion and save partial ratings on close", async ({
  page,
  request,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await request.post(`${API}/__reset`);
  await page.goto("/add");
  await page.getByRole("button", { name: "Log Running", exact: true }).click();
  await page
    .getByRole("button", { name: "Set quantity to 45", exact: true })
    .click();
  await page.getByRole("button", { name: "Log Activity", exact: true }).click();
  await page
    .getByRole("button", { name: "Log without photo", exact: true })
    .click();
  const effort = page.getByTestId("difficulty-follow-up");
  const header = effort.getByRole("heading", { name: "How hard was Running?" });
  await expect(header).toBeVisible();
  await expect(header.locator("..")).toHaveCSS("opacity", "1");
  await effort.getByRole("button", { name: "Skip", exact: true }).click();
  const metrics = page.getByTestId("metrics-follow-up");
  await metrics
    .getByRole("button", { name: "Energy rating 4", exact: true })
    .click();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(
    page.getByText("Activity logged!", { exact: true }),
  ).toBeVisible();
  const state = await (await request.get(`${API}/__state`)).json();
  const ratings = state.requests.filter(
    (r: any) => r.path === "/metrics/entries" && r.method === "POST",
  );
  expect(ratings).toHaveLength(1);
  expect(ratings[0].body.rating).toBe(4);
});
