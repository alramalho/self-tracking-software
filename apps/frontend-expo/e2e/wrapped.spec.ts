import { test, expect } from "@playwright/test";
const API = "http://127.0.0.1:4317";
for (const theme of ["DARK", "LIGHT"])
  test(`wrapped stories, badge drawer and Home retap in ${theme}`, async ({
    page,
    request,
  }) => {
    await request.post(`${API}/__reset`);
    await request.post(`${API}/__wrapped`);
    await request.patch(`${API}/users/user`, {
      headers: { Authorization: "Bearer local-e2e-token" },
      data: { themeMode: theme },
    });
    await page.goto("/profile");
    await page.getByTestId("profile-badge-streaks").click();
    await expect(
      page.getByText("How badges are earned", { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByText("• Each incomplete week subtracts -1 from your streak"),
    ).toBeVisible();
    await expect
      .poll(
        async () =>
          (await page.getByTestId("badge-details").boundingBox())?.y ?? 9999,
      )
      .toBeLessThan(300);
    await page.screenshot({ path: `test-results/streak-drawer-${theme}.png` });
    await page.getByRole("button", { name: "Close badge details" }).click();
    await expect(page.getByTestId("badge-details")).not.toBeVisible();
    await page.getByTestId("profile-badge-habits").click();
    await expect(page.getByText(/Alex achieved 2 habit badges/)).toBeVisible();
    await page.getByRole("button", { name: "Close badge details" }).click();
    await page.getByRole("button", { name: "Your 2025 wrapped" }).click();
    await expect(page.getByTestId("wrapped-story-hero")).toBeVisible();
    await page.screenshot({ path: `test-results/wrapped-hero-${theme}.png` });
    await page.mouse.click(370, 410);
    await expect(page.getByTestId("wrapped-story-world")).toBeVisible();
    await page.getByRole("button", { name: "Explore Portugal" }).click();
    await expect(
      page.getByTestId("wrapped-map").getByText("Portugal", { exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: `test-results/wrapped-world-${theme}.png` });
    for (const story of [
      "journey",
      "plans",
      "mood",
      "activities",
      "friends",
      "streaks",
    ]) {
      await page
        .getByRole("button", { name: `Go to ${story} story`, exact: true })
        .click();
      await expect(page.getByTestId(`wrapped-story-${story}`)).toBeVisible();
      await expect(page.getByTestId("wrapped-story-transition")).toHaveCSS("opacity", "1");
      if (story === "friends" || story === "streaks") {
        const sam = page.getByTestId("wrapped-ranking-row-sam");
        await expect(sam).toHaveCSS("opacity", "1");
        await expect(sam).toContainText(story === "friends" ? "470" : "19");
      }
      await page.screenshot({
        path: `test-results/wrapped-${story}-${theme}.png`,
      });
      if (story === "journey") {
        await page.getByText("Pause journey", { exact: true }).click();
        await page
          .getByRole("button", { name: "Journey segment 3", exact: true })
          .click();
        await expect(
          page.getByText("Play journey", { exact: true }),
        ).toBeVisible();
      }
      if (story === "plans") {
        await page
          .getByRole("button", {
            name: "Filter memories for Exercise regularly",
          })
          .click();
        await expect(page.getByTestId("wrapped-story-plans")).toBeVisible();
        await page
          .getByRole("button", { name: /Open memory/ })
          .first()
          .click();
        await expect(
          page.getByRole("button", { name: "Close memory" }),
        ).toBeVisible();
        await page.getByRole("button", { name: "Close memory" }).click();
        await expect(
          page.getByRole("button", { name: "Close memory" }),
        ).not.toBeVisible();
      }
    }
    await page
      .getByRole("button", { name: "Go to hero story", exact: true })
      .click();
    await page.evaluate(() =>
      Object.defineProperty(navigator, "canShare", {
        value: () => false,
        configurable: true,
      }),
    );
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Share wrapped story" }).click();
    expect((await download).suggestedFilename()).toBe("wrapped-2025.png");
    await page.getByRole("button", { name: "Close wrapped" }).click();
    await expect(page.getByTestId("profile-screen")).toBeVisible();
    await page.getByRole("tab", { name: "Home", exact: true }).click();
    const feed = page.getByTestId("home-feed");
    await feed.evaluate((el) => {
      el.scrollTop = 1300;
    });
    await expect
      .poll(() => feed.evaluate((el) => el.scrollTop))
      .toBeGreaterThan(300);
    await page.getByRole("tab", { name: "Home", exact: true }).dblclick();
    await expect
      .poll(() => feed.evaluate((el) => el.scrollTop))
      .toBeLessThan(2);
  });
test("wrapped empty states", async ({ page, request }) => {
  await request.post(`${API}/__reset`);
  await request.post(`${API}/__wrapped`, { data: { empty: true } });
  await page.goto("/wrapped");
  await expect(page.getByTestId("wrapped-story-hero")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Go to plans story" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Go to world story" }).click();
  await expect(
    page.getByText("No activity locations recorded for 2025."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Go to mood story" }).click();
  await expect(page.getByText("Not enough mood data for 2025")).toBeVisible();
});

test("Wrapped replays staggered rankings and respects reduced motion", async ({ page, request }) => {
  await request.post(`${API}/__reset`);
  await request.post(`${API}/__wrapped`);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/wrapped");
  await expect(page.getByTestId("wrapped-story-hero")).toBeVisible();
  for (const story of ["friends", "streaks", "friends"]) {
    await page.getByRole("button", { name: `Go to ${story} story`, exact: true }).click();
    const row = page.getByTestId("wrapped-ranking-row-sam");
    await expect(page.getByTestId(`wrapped-story-${story}`)).toBeVisible();
    const frames = await row.evaluate(element => new Promise<number[]>(resolve => {
      const values: number[] = [];
      const start = performance.now();
      const sample = () => {
        values.push(Number(getComputedStyle(element).opacity));
        if (performance.now() - start < 1200) requestAnimationFrame(sample);
        else resolve(values);
      };
      sample();
    }));
    expect(frames.some(value => value === 0)).toBe(true);
    expect(frames.some(value => value > 0 && value < 1)).toBe(true);
    await expect(row).toHaveCSS("opacity", "1");
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Go to streaks story", exact: true }).click();
  await expect(page.getByTestId("wrapped-story-streaks")).toBeVisible();
  await expect(page.getByTestId("wrapped-story-transition")).toHaveCSS("opacity", "1");
  await expect(page.getByTestId("wrapped-ranking-row-sam")).toHaveCSS("opacity", "1");
});

test("wrapped recovers from a failed data request", async ({
  page,
  request,
}) => {
  await request.post(`${API}/__reset`);
  await request.post(`${API}/__wrapped`);
  let failing = true;
  await page.route(`${API}/plans`, (route) =>
    failing
      ? route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ message: "Temporarily unavailable" }),
        })
      : route.continue(),
  );
  await page.goto("/wrapped");
  await expect(
    page.getByRole("button", { name: "Try again", exact: true }),
  ).toBeVisible();
  failing = false;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByTestId("wrapped-story-hero")).toBeVisible();
});
