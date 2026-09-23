import { expect, test } from "@playwright/test";

test("linked workout shows the available private Watch vitals", async ({ page }) => {
  await page.route("**/health/apple/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/status")) {
      await route.fulfill({ json: { connected: true, importStats: { sleepSampleCount: 0 } } });
      return;
    }
    if (path.endsWith("/reconciliation-preview")) {
      await route.fulfill({
        json: {
          summary: { total: 1, pending: 0, resolved: 1 },
          items: [{
            healthWorkout: {
              id: "vitals-run",
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
                { latitude: 38.7223, longitude: -9.1393, distanceMeters: 0 },
                { latitude: 38.7231, longitude: -9.1384, distanceMeters: 1100, elevationMeters: 68 },
                { latitude: 38.7224, longitude: -9.1375, distanceMeters: 2500, elevationMeters: 51 },
                { latitude: 38.7240, longitude: -9.1368, distanceMeters: 6300, elevationMeters: 96 },
              ],
              sourceName: "Apple Watch",
              deviceName: "Alexandre’s Apple Watch",
            },
            category: "resolved",
            candidates: [],
            mismatches: [],
            suggestedActivity: null,
            recommendedAction: null,
            resolved: {
              action: "link_keep",
              activityEntryId: "entry-run",
              healthDataIsPublic: false,
              linkedActivity: {
                title: "morning run",
                emoji: "🏃",
                measure: "kilometers",
                quantity: 6,
              },
              confirmedAt: "2026-09-15T08:00:00Z",
            },
          }],
        },
      });
      return;
    }
    await route.fulfill({ json: {} });
  });
  await page.goto("/health-workout/vitals-run");
  await expect(page.getByText("Private Watch data", { exact: true })).toBeVisible();
  await expect(page.getByText("🏃 morning run", { exact: true })).toBeVisible();
  await expect(page.getByText("168 bpm", { exact: true })).toBeVisible();
  await expect(page.getByText("438 kcal", { exact: true })).toBeVisible();
  await expect(page.getByText("6.30 km", { exact: true })).toBeVisible();
  await expect(page.getByText("96 m", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Elevation profile", { exact: true })).toBeVisible();
  await expect(page.getByTestId("elevation-axis-labels")).toBeVisible();
  await expect(page.getByTestId("elevation-axis-labels").getByText("96 m", { exact: true })).toBeVisible();
  await expect(page.getByTestId("elevation-axis-labels").getByText("69 m", { exact: true })).toBeVisible();
  await expect(page.getByTestId("elevation-axis-labels").getByText("42 m", { exact: true })).toBeVisible();
  await expect(page.getByText("Heart rate", { exact: true })).toBeVisible();
  await expect(page.getByText("Map", { exact: true })).toBeVisible();
  await expect(page.getByTestId("heart-rate-chart")).toBeVisible();
  await expect(page.getByTestId("workout-route-map")).toBeVisible();
  await expect(page.getByText("Heart-rate zones", { exact: true })).toBeVisible();
  await expect(page.getByText("15m", { exact: true })).toBeVisible();
  await page.getByTestId("share-workout-button").click();
  await expect(page.getByTestId("workout-share-editor")).toBeVisible();
  await expect(page.getByTestId("workout-share-preview")).toBeVisible();
  await expect(page.getByTestId("workout-share-viewport")).toBeVisible();
  await expect(page.getByTestId("workout-share-watermark")).toBeVisible();
  await expect(page.getByTestId("workout-share-preview").getByText("Running", { exact: true })).toHaveCount(0);
  await page.getByTestId("share-map-color-ice").click();
  await page.getByTestId("share-stats-count-6").click();
  await page.getByTestId("share-orientation-landscape").click();
  await expect(page.getByText("Transparent PNG · adjust the route color, stats and format below.", { exact: true })).toBeVisible();
  for (const label of ["Distance", "Time", "Pace", "Elevation", "Avg heart rate", "Calories"]) {
    await expect(page.getByTestId("workout-share-preview").getByText(label, { exact: true })).toBeVisible();
  }
  const viewportBox = await page.getByTestId("workout-share-viewport").boundingBox();
  const previewBox = await page.getByTestId("workout-share-preview").boundingBox();
  expect(viewportBox).not.toBeNull();
  expect(previewBox).not.toBeNull();
  expect(previewBox!.width).toBeLessThanOrEqual(viewportBox!.width + 1);
  expect(previewBox!.height).toBeLessThanOrEqual(viewportBox!.height + 1);
  await page.screenshot({ path: "test-results/workout-vitals.png", fullPage: true });
});

const API = `http://127.0.0.1:${process.env.E2E_API_PORT || "4317"}`;

for (const theme of ["DARK", "LIGHT"]) {
  test(`running workout without a reliable distance trace keeps average pace in ${theme}`, async ({ page, request }) => {
    await request.post(`${API}/__reset`);
    await request.post(`${API}/__health-batch`, {
      headers: { Authorization: "Bearer local-e2e-token" },
    });
    await request.patch(`${API}/users/user`, {
      headers: { Authorization: "Bearer local-e2e-token" },
      data: { themeMode: theme },
    });
    await page.route("**/health/apple/workouts/reconciliation-preview", async (route) => {
      const response = await route.fetch();
      const preview = await response.json();
      for (const item of preview.items ?? []) {
        item.healthWorkout.distanceTimeSeries = [
          { elapsedSeconds: 0, distanceMeters: 0 },
          { elapsedSeconds: 1800, distanceMeters: 5100 },
        ];
      }
      await route.fulfill({ response, json: preview });
    });
    await page.goto("/health-workout/health-run");
    await expect(page.getByText("Average pace")).toBeVisible();
    await expect(page.getByText("No reliable timed distance trace is available for this workout.")).toBeVisible();
    await page.getByTestId("kilometre-splits").screenshot({ path: `test-results/workout-splits-unavailable-${theme.toLowerCase()}.png` });
  });

}
