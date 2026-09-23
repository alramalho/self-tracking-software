import { expect, test } from "@playwright/test";

const API = `http://127.0.0.1:${process.env.E2E_API_PORT || 4321}`;
const samples = [
  { elapsedSeconds: 60, bpm: 104 },
  { elapsedSeconds: 90, bpm: 112 },
  { elapsedSeconds: 120, bpm: 120 },
  { elapsedSeconds: 150, bpm: 130 },
  { elapsedSeconds: 180, bpm: 141 },
  { elapsedSeconds: 210, bpm: 151 },
  { elapsedSeconds: 240, bpm: 163 },
  { elapsedSeconds: 270, bpm: 173 },
  { elapsedSeconds: 300, bpm: 180 },
  { elapsedSeconds: 720, bpm: 160 },
  { elapsedSeconds: 750, bpm: 151 },
  { elapsedSeconds: 780, bpm: 141 },
];
const pausedSamples = [
  { elapsedSeconds: 2600, bpm: 145 },
  { elapsedSeconds: 2630, bpm: 148 },
  { elapsedSeconds: 3300, bpm: 160 },
  { elapsedSeconds: 3330, bpm: 165 },
];

const cases = [
  { name: "Apple age-based zones", theme: "DARK", provider: "apple", age: null, zones: { estimatedMaxHeartRateBpm: 190, source: "age_estimate", zone1Seconds: 60, zone2Seconds: 60, zone3Seconds: 60, zone4Seconds: 60, zone5Seconds: 60 }, expected: "Estimated zones from workout age", hasSamples: true, paused: false },
  { name: "Garmin samples with profile age", theme: "LIGHT", provider: "garmin", age: 30, zones: null, expected: "Estimated zones from current profile age", hasSamples: true, paused: false },
  { name: "Garmin samples without personal age", theme: "DARK", provider: "garmin", age: null, zones: { estimatedMaxHeartRateBpm: 200, source: "default", zone1Seconds: 0, zone2Seconds: 0, zone3Seconds: 0, zone4Seconds: 0, zone5Seconds: 0 }, expected: "Zones unavailable without your age", hasSamples: true, paused: false },
  { name: "Garmin summary without samples", theme: "LIGHT", provider: "garmin", age: null, zones: null, expected: "", hasSamples: false, paused: false },
  { name: "Apple paused workout", theme: "LIGHT", provider: "apple", age: 30, zones: null, expected: "Estimated zones from current profile age", hasSamples: true, paused: true },
] as const;

for (const scenario of cases) {
  test(`heart-rate progression: ${scenario.name} in ${scenario.theme}`, async ({ page, request }) => {
    await request.post(`${API}/__reset`);
    const profileUpdate = await request.patch(`${API}/users/user`, {
      headers: { Authorization: "Bearer local-e2e-token" },
      data: { themeMode: scenario.theme, age: scenario.age },
    });
    expect(profileUpdate.ok()).toBe(true);
    await page.route("**/health/apple/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/status")) {
        await route.fulfill({ json: { connected: scenario.provider === "apple", importStats: { workoutCount: 1 } } });
        return;
      }
      if (path.endsWith("/reconciliation-preview")) {
        await route.fulfill({ json: {
          summary: { total: 1, pending: 0, resolved: 1 },
          items: [{
            healthWorkout: {
              id: "zone-run",
              provider: scenario.provider,
              activityTypeName: "running",
              displayName: "Running",
              startAt: "2026-09-15T07:00:00Z",
              endAt: scenario.paused ? "2026-09-15T08:00:00Z" : "2026-09-15T07:15:00Z",
              durationSeconds: scenario.paused ? 2700 : 900,
              distanceMeters: 2400,
              activeEnergyKcal: 220,
              averageHeartRateBpm: 147,
              maximumHeartRateBpm: 180,
              heartRateZones: scenario.zones,
              heartRateSeries: scenario.paused ? pausedSamples : scenario.hasSamples ? samples : null,
              sourceName: scenario.provider === "apple" ? "Apple Watch" : "Garmin",
              deviceName: scenario.provider === "apple" ? "Apple Watch" : "Forerunner",
              timezone: "Europe/Lisbon",
            },
            category: "resolved",
            confidence: 1,
            mismatches: [],
            candidates: [],
            suggestedActivity: null,
            recommendedAction: null,
            resolved: null,
          }],
        } });
        return;
      }
      await route.fulfill({ json: {} });
    });
    await page.route("**/health/garmin/status", (route) => route.fulfill({ json: { connected: scenario.provider === "garmin", importStats: { workoutCount: 1 } } }));
    await page.goto("/health-workout/zone-run");
    if (!scenario.hasSamples) {
      await expect(page.getByTestId("heart-rate-chart")).toHaveCount(0);
      const unavailable = page.getByTestId("heart-rate-chart-unavailable");
      await expect(unavailable).toContainText("without timestamped readings to plot");
      await unavailable.screenshot({ path: "test-results/heart-rate-summary-only.png" });
      return;
    }
    const chart = page.getByTestId("heart-rate-chart");
    await expect(chart).toBeVisible();
    await expect(chart.getByText(scenario.expected)).toBeVisible();
    if (scenario.paused) {
      await expect(page.getByTestId("heart-rate-chart-plot")).toHaveAttribute("aria-label", /4 recorded samples over 1h 0m elapsed/);
    }
    await expect(page.getByTestId("heart-rate-chart-plot")).toHaveAttribute("aria-label", /Missing sample periods are shown as gaps/);
    await expect(chart.getByText("Breaks indicate missing readings.", { exact: false })).toBeVisible();
    if (scenario.age == null && scenario.provider === "garmin") {
      await expect(chart.getByText("Heart rate is recorded; add your age in Profile to estimate zones.", { exact: false })).toBeVisible();
      await expect(chart.getByText("Z1", { exact: true })).toHaveCount(0);
    } else {
      await expect(chart.getByText("Z1", { exact: true })).toBeVisible();
      await expect(chart.getByText("Z5", { exact: true })).toBeVisible();
    }
    await chart.screenshot({ path: `test-results/heart-rate-${scenario.provider}-${scenario.theme.toLowerCase()}-${scenario.age ?? "no-age"}.png` });
  });
}
