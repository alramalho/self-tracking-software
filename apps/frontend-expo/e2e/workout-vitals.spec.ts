import { expect, test } from "@playwright/test";

const API = "http://127.0.0.1:4317";

for (const theme of ["DARK", "LIGHT"]) {
  test(`linked workout privacy is editable in ${theme}`, async ({
    page,
    request,
  }) => {
    await request.post(`${API}/__reset`);
    await request.patch(`${API}/users/user`, {
      headers: { Authorization: "Bearer local-e2e-token" },
      data: { themeMode: theme },
    });
    let healthDataIsPublic = false;
    let privacyRequest: Record<string, unknown> | undefined;
    await page.route("**/health/apple/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (
        path.endsWith("/workouts/privacy") &&
        route.request().method() === "PATCH"
      ) {
        privacyRequest = route.request().postDataJSON() as Record<
          string,
          unknown
        >;
        healthDataIsPublic = privacyRequest.shareHealthData === true;
        await route.fulfill({
          json: {
            healthDataIsPublic,
            shareHealthDataByDefault: privacyRequest.makeDefault === true,
          },
        });
        return;
      }
      if (path.endsWith("/status")) {
        await route.fulfill({
          json: { connected: true, importStats: { sleepSampleCount: 0 } },
        });
        return;
      }
      if (path.endsWith("/workouts/vitals-run")) {
        await route.fulfill({
          json: {
            isOwner: true,
            canEditPrivacy: true,
                healthWorkout: {
                  id: "vitals-run",
                  provider: "apple_health",
                  displayName: "Running",
                  activityTypeName: "running",
                  startAt: "2026-09-15T07:00:00Z",
                  endAt: "2026-09-15T07:39:00Z",
                  durationSeconds: 2340,
                  distanceMeters: 6300,
                  activeEnergyKcal: 438,
                  elevationAscendedMeters: 96,
                  elevationDescendedMeters: 91,
                  effortScore: 7,
                  effortSource: "user",
                  averageHeartRateBpm: 168,
                  maximumHeartRateBpm: 184,
                  heartRateZones: {
                    estimatedMaxHeartRateBpm: 190,
                    source: "age_estimate",
                    zone1Seconds: 120,
                    zone2Seconds: 600,
                    zone3Seconds: 900,
                    zone4Seconds: 600,
                    zone5Seconds: 120,
                  },
                  heartRateSeries: [
                    { elapsedSeconds: 0, bpm: 132 },
                    { elapsedSeconds: 840, bpm: 174 },
                    { elapsedSeconds: 1560, bpm: 166 },
                    { elapsedSeconds: 2340, bpm: 181 },
                  ],
                  elevationProfile: [
                    { distanceMeters: 0, elevationMeters: 42 },
                    { distanceMeters: 1800, elevationMeters: 68 },
                    { distanceMeters: 3600, elevationMeters: 51 },
                    { distanceMeters: 6300, elevationMeters: 96 },
                  ],
                  route: [
                    {
                      latitude: 38.7223,
                      longitude: -9.1393,
                      distanceMeters: 0,
                    },
                    {
                      latitude: 38.7231,
                      longitude: -9.1384,
                      distanceMeters: 1100,
                      elevationMeters: 68,
                    },
                    {
                      latitude: 38.7224,
                      longitude: -9.1375,
                      distanceMeters: 2500,
                      elevationMeters: 51,
                    },
                    {
                      latitude: 38.724,
                      longitude: -9.1368,
                      distanceMeters: 6300,
                      elevationMeters: 96,
                    },
                  ],
                  sourceName: "Apple Watch",
                  deviceName: "Alexandre’s Apple Watch",
                },
                resolved: {
                  action: "link_keep",
                  activityEntryId: "entry-run",
                  healthDataIsPublic,
                  linkedActivity: {
                    title: "morning run",
                    emoji: "🏃",
                    measure: "kilometers",
                    quantity: 6,
                  },
                  confirmedAt: "2026-09-15T08:00:00Z",
                },
          },
        });
        return;
      }
      await route.fulfill({ json: {} });
    });
    await page.goto("/health-workout/vitals-run");
    await expect(
      page.getByText("Private Watch data", { exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: `test-results/workout-vitals-screen-${theme.toLowerCase()}.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Change Watch data privacy" })
      .click();
    const privacyEditor = page.getByTestId("workout-privacy-editor");
    await expect(privacyEditor).toBeVisible();
  await page.screenshot({
    path: `test-results/workout-privacy-${theme.toLowerCase()}.png`,
  });
    await privacyEditor
      .getByRole("button", { name: "Share with activity", exact: true })
      .click();
    await privacyEditor
      .getByRole("checkbox", {
        name: "Make this my default for future Watch workouts",
      })
      .click();
    await privacyEditor
      .getByRole("button", { name: "Save privacy", exact: true })
      .click();
    await expect(privacyEditor).toBeHidden();
    expect(privacyRequest).toMatchObject({
      healthWorkoutId: "vitals-run",
      shareHealthData: true,
      makeDefault: true,
    });
    await expect(
      page.getByText("Shared with activity", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("🏃 morning run", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("168 bpm", { exact: true })).toBeVisible();
    await expect(page.getByText("438 kcal", { exact: true })).toBeVisible();
    await expect(page.getByText("6.30 km", { exact: true })).toBeVisible();
    await expect(page.getByText("96 m", { exact: true }).first()).toBeVisible();
    await expect(
      page.getByText("Elevation profile", { exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("elevation-axis-labels")).toBeVisible();
    await expect(
      page
        .getByTestId("elevation-axis-labels")
        .getByText("96 m", { exact: true }),
    ).toBeVisible();
    await expect(
      page
        .getByTestId("elevation-axis-labels")
        .getByText("69 m", { exact: true }),
    ).toBeVisible();
    await expect(
      page
        .getByTestId("elevation-axis-labels")
        .getByText("42 m", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Heart rate", { exact: true })).toBeVisible();
    await expect(page.getByText("Map", { exact: true })).toBeVisible();
    await expect(page.getByTestId("heart-rate-chart")).toBeVisible();
    await expect(page.getByTestId("workout-route-map")).toBeVisible();
    await expect(
      page.getByText("Heart-rate zones", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("15m", { exact: true })).toBeVisible();
    await page.getByTestId("share-workout-button").click();
    await expect(page.getByTestId("workout-share-editor")).toBeVisible();
    await expect(page.getByTestId("workout-share-preview")).toBeVisible();
    await expect(page.getByTestId("workout-share-viewport")).toBeVisible();
    await expect(page.getByTestId("workout-share-watermark")).toBeVisible();
    await expect(page.getByTestId("workout-share-brand-mark")).toBeVisible();
    await expect(
      page
        .getByTestId("workout-share-preview")
        .getByText("Running", { exact: true }),
    ).toHaveCount(0);
    await page.getByTestId("share-map-color-ice").click();
    await page.getByTestId("share-stats-count-6").click();
    await page.getByTestId("share-orientation-landscape").click();
    await expect(
      page.getByText(
        "Transparent PNG · adjust the route color, stats and format below.",
        { exact: true },
      ),
    ).toBeVisible();
    const landscapePreview = page.getByTestId("workout-share-preview");
    const landscapeWatermark = page.getByTestId("workout-share-watermark");
    const landscapeCanvasBox = await landscapePreview.boundingBox();
    expect(landscapeCanvasBox).not.toBeNull();
    expect(landscapeCanvasBox!.width / landscapeCanvasBox!.height).toBeCloseTo(2, 1);
    const assertWatermarkAnchoredToMap = async () => {
      const canvasBox = await landscapePreview.boundingBox();
      const mapBox = await page.getByTestId("workout-share-route").boundingBox();
      const watermarkBox = await landscapeWatermark.boundingBox();
      const startBox = await page.getByTestId("workout-share-route-start").boundingBox();
      const finishBox = await page.getByTestId("workout-share-route-finish").boundingBox();
      expect(canvasBox).not.toBeNull();
      expect(mapBox).not.toBeNull();
      expect(watermarkBox).not.toBeNull();
      expect(startBox).not.toBeNull();
      expect(finishBox).not.toBeNull();
      expect(watermarkBox!.width).toBeGreaterThan(0);
      expect(watermarkBox!.height).toBeGreaterThan(0);
      expect(watermarkBox!.x).toBeGreaterThanOrEqual(mapBox!.x);
      expect(watermarkBox!.y).toBeGreaterThanOrEqual(mapBox!.y);
      expect(watermarkBox!.x + watermarkBox!.width).toBeLessThanOrEqual(mapBox!.x + mapBox!.width + 1);
      expect(watermarkBox!.y + watermarkBox!.height).toBeLessThanOrEqual(mapBox!.y + mapBox!.height + 1);
      expect(mapBox!.x + mapBox!.width - (watermarkBox!.x + watermarkBox!.width)).toBeLessThan(14);
      expect(mapBox!.y + mapBox!.height - (watermarkBox!.y + watermarkBox!.height)).toBeLessThan(14);
      for (const markerBox of [startBox!, finishBox!]) {
        expect(markerBox.x).toBeGreaterThanOrEqual(canvasBox!.x);
        expect(markerBox.y).toBeGreaterThanOrEqual(canvasBox!.y);
        expect(markerBox.x + markerBox.width).toBeLessThanOrEqual(canvasBox!.x + canvasBox!.width + 1);
        expect(markerBox.y + markerBox.height).toBeLessThanOrEqual(canvasBox!.y + canvasBox!.height + 1);
      }
    };
    await assertWatermarkAnchoredToMap();
    for (const label of [
      "Distance",
      "Time",
      "Pace",
      "Elevation",
      "Avg heart rate",
      "Calories",
    ]) {
      await expect(
        page
          .getByTestId("workout-share-preview")
          .getByText(label, { exact: true }),
      ).toBeVisible();
    }
    await page.getByTestId("share-stats-count-3").click();
    await assertWatermarkAnchoredToMap();
    const viewportBox = await page
      .getByTestId("workout-share-viewport")
      .boundingBox();
    const previewBox = await page
      .getByTestId("workout-share-preview")
      .boundingBox();
    expect(viewportBox).not.toBeNull();
    expect(previewBox).not.toBeNull();
    expect(previewBox!.width).toBeLessThanOrEqual(viewportBox!.width + 1);
    expect(previewBox!.height).toBeLessThanOrEqual(viewportBox!.height + 1);
    // Visibility alone misses clipping. Check every edge, including descendants,
    // against both the exported canvas and the preview viewport on narrow phones.
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      for (const orientation of ["portrait", "landscape"]) {
        await page.getByTestId(`share-orientation-${orientation}`).click();
        for (const count of [3, 6]) {
          await page.getByTestId(`share-stats-count-${count}`).click();
          const canvas = page.getByTestId("workout-share-preview");
          const viewport = page.getByTestId("workout-share-viewport");
          await expect(async () => {
            const outer = (await viewport.boundingBox())!;
            const bounds = (await canvas.boundingBox())!;
            const contains = (parent: typeof bounds, child: typeof bounds) => {
              expect(child.x).toBeGreaterThanOrEqual(parent.x - 1);
              expect(child.y).toBeGreaterThanOrEqual(parent.y - 1);
              expect(child.x + child.width).toBeLessThanOrEqual(parent.x + parent.width + 1);
              expect(child.y + child.height).toBeLessThanOrEqual(parent.y + parent.height + 1);
            };
            contains(outer, bounds);
            for (const testID of ["workout-share-route", "workout-share-route-start", "workout-share-route-finish", "workout-share-watermark", "workout-share-stats"]) {
              contains(bounds, (await page.getByTestId(testID).boundingBox())!);
            }
            const labels = page.getByTestId("workout-share-stats").locator('[dir="auto"]');
            expect(await labels.count()).toBe(count * 2);
            for (const label of await labels.all()) {
              contains(bounds, (await label.boundingBox())!);
              expect(await label.evaluate((node) => node.scrollWidth <= node.clientWidth + 1), await label.textContent() ?? "stat").toBe(true);
            }
          }).toPass({ timeout: 5000 });
          await canvas.screenshot({ path: `test-results/workout-share-${theme.toLowerCase()}-${width}-${orientation}-${count}.png` });
        }
      }
    }
    await page.screenshot({
      path: `test-results/workout-vitals-${theme.toLowerCase()}.png`,
      fullPage: true,
    });
  });
}

test("a viewer can explore shared Garmin details without owner controls", async ({ page }) => {
  await page.route("**/health/apple/workouts/shared-garmin", async (route) => {
    await route.fulfill({
      json: {
        healthWorkout: {
          id: "shared-garmin",
          provider: "garmin_connect",
          displayName: "Running",
          activityTypeName: "running",
          startAt: "2026-09-15T07:00:00Z",
          endAt: "2026-09-15T07:30:00Z",
          durationSeconds: 1800,
          distanceMeters: 5000,
          activeEnergyKcal: 354,
          averageHeartRateBpm: 168,
          maximumHeartRateBpm: 180,
          sourceName: "Garmin Connect",
          deviceName: "Forerunner",
          timezone: "Europe/Lisbon",
        },
        resolved: {
          action: "link_keep",
          activityEntryId: "friend-entry",
          healthDataIsPublic: true,
          linkedActivity: {
            title: "Morning run",
            emoji: "🏃",
            measure: "kilometers",
            quantity: 5,
          },
          confirmedAt: "2026-09-15T08:00:00Z",
        },
        isOwner: false,
        canEditPrivacy: false,
      },
    });
  });
  await page.goto("/health-workout/shared-garmin");
  await expect(page.getByText("Garmin workout vitals")).toBeVisible();
  await expect(page.getByText("168 bpm", { exact: true })).toBeVisible();
  await expect(page.getByText("354 kcal", { exact: true })).toBeVisible();
  await expect(page.getByText("5.00 km", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Change Watch data privacy" })).toHaveCount(0);
  await page.screenshot({
    path: "test-results/workout-vitals-viewer-garmin.png",
    fullPage: true,
  });
});
