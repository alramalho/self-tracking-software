import { test, expect } from "@playwright/test";
const API = "http://127.0.0.1:4317";
for (const theme of ["DARK", "LIGHT"])
  for (const width of [320, 390]) {
    test(`profile badges and equal stat columns ${theme} ${width}`, async ({
      page,
      request,
    }) => {
      await request.post(`${API}/__reset`);
      await request.post(`${API}/__profile-design`);
      await request.patch(`${API}/users/user`, {
        headers: { Authorization: "Bearer local-e2e-token" },
        data: { themeMode: theme },
      });
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/profile");
      const header = page.getByTestId("profile-header");
      const friends = await header
        .getByRole("button", { name: /Friends$/ })
        .boundingBox();
      const points = await header
        .getByRole("button", { name: "600 Points", exact: true })
        .boundingBox();
      const gold = await header
        .getByRole("button", { name: "Gold level", exact: true })
        .boundingBox();
      expect(Math.abs(friends!.width - points!.width)).toBeLessThan(1);
      expect(Math.abs(points!.width - gold!.width)).toBeLessThan(1);
      expect(
        Math.abs(points!.x - friends!.x - (gold!.x - points!.x)),
      ).toBeLessThan(1);
      expect(width - (gold!.x + gold!.width)).toBeCloseTo(16, 0);
      const settings = await page.getByTestId("profile-settings").boundingBox();
      expect(width - settings!.x - settings!.width).toBeCloseTo(8, 0);
      for (const kind of ["streaks", "habits", "lifestyles"]) {
        await expect(
          page.getByTestId(`profile-animation-${kind}`),
        ).toBeVisible();
        await expect
          .poll(
            () =>
              page
                .getByTestId(`profile-animation-${kind}`)
                .locator("canvas")
                .evaluate((canvas: HTMLCanvasElement) =>
                  (() => {
                    const copy = document.createElement("canvas");
                    copy.width = canvas.width;
                    copy.height = canvas.height;
                    const context = copy.getContext("2d")!;
                    context.drawImage(canvas, 0, 0);
                    const pixels = context.getImageData(
                      0,
                      0,
                      copy.width,
                      copy.height,
                    ).data;
                    for (let i = 0; i < pixels.length; i += 4)
                      if (
                        pixels[i + 3] > 100 &&
                        Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) -
                          Math.min(pixels[i], pixels[i + 1], pixels[i + 2]) >
                          30
                      )
                        return true;
                    return false;
                  })(),
                ),
            { timeout: 20000 },
          )
          .toBe(true);
        const box = await page
          .getByTestId(`profile-badge-${kind}`)
          .boundingBox();
        expect(box!.width).toBe(50);
        expect(box!.height).toBe(62);
        expect(box!.x).toBeGreaterThanOrEqual(16);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width - 16);
      }
      await page.screenshot({
        path: `test-results/profile-${theme}-${width}.png`,
      });
      await header
        .getByRole("button", { name: "7 streaks", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Explore streak for Exercise regularly", exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Close badge details", exact: true }).click();
      await header
        .getByRole("button", { name: "Gold level", exact: true })
        .click();
      const progress = page.getByTestId("progress-details");
      await expect(
        progress.getByText("600 points", { exact: true }).first(),
      ).toBeVisible();
      await expect(progress.getByText("All Levels", { exact: true })).toBeVisible();
    });
  }
test("unearned profile badges keep the PWA muted outline state", async ({
  page,
  request,
}) => {
  await request.post(`${API}/__reset`);
  await request.post(`${API}/__profile-design`, { data: { empty: true } });
  await page.goto("/profile");
  for (const kind of ["streaks", "habits", "lifestyles"]) {
    await expect(page.getByTestId(`profile-animation-${kind}`)).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: `0 ${kind}`, exact: true }),
    ).toHaveCSS("opacity", "0.5");
  }
});
