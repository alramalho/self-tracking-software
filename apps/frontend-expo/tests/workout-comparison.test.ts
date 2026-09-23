import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { healthFixture, resetHealthFixture } from "../e2e/health-fixture";
import { loadComparisonWorkout, mapComparisonWorkout } from "../e2e/workout-comparison/fixture";

const synthetic = {
  id: "source-private-id",
  activityTypeName: "running",
  startAt: "2026-09-15T07:00:00Z",
  endAt: "2026-09-15T08:00:00Z",
  durationSeconds: 2700,
  distanceMeters: 5000,
  sourceName: "Apple Watch",
  age: 30,
  metadata: {
    averageHeartRateBpm: 140,
    heartRateZones: {
      source: "default",
      estimatedMaxHeartRateBpm: 200,
      zone1Seconds: 60,
      zone2Seconds: 60,
      zone3Seconds: 60,
      zone4Seconds: 60,
      zone5Seconds: 60,
    },
    heartRateSeries: [
      { elapsedSeconds: 100, bpm: 130 },
      { elapsedSeconds: 3300, bpm: 160 },
    ],
  },
};

test("local comparison preserves supplied samples and post-pause timestamps", () => {
  const result = mapComparisonWorkout(synthetic);
  assert.equal(result.preview.id, "health-run");
  assert.equal(result.profileAge, 30);
  assert.deepEqual(result.preview.heartRateSeries, synthetic.metadata.heartRateSeries);
  assert.equal(result.preview.heartRateSeries?.[1].elapsedSeconds, 3300);
  assert.equal(result.preview.durationSeconds, 2700);
  assert.equal(result.preview.distanceTimeSeries, null);
  assert.equal(result.preview.route, null);
  assert.equal(result.preview.heartRateZones?.source, "default");
});

test("absent or invalid timed samples remain absent", () => {
  const result = mapComparisonWorkout({
    ...synthetic,
    age: null,
    metadata: {
      ...synthetic.metadata,
      heartRateSeries: undefined,
      distanceTimeSeries: [{ elapsedSeconds: 0, distanceMeters: 0 }],
    },
  });
  assert.equal(result.profileAge, null);
  assert.equal(result.preview.heartRateSeries, null);
  assert.equal(result.preview.distanceTimeSeries, null);
});

test("timezone-free PostgreSQL timestamps are interpreted as UTC", () => {
  const result = mapComparisonWorkout({
    ...synthetic,
    startAt: "2026-09-15T07:00:00.000",
    endAt: "2026-09-15T08:00:00.000",
  });
  assert.equal(result.preview.startAt, "2026-09-15T07:00:00.000Z");
  assert.equal(result.preview.endAt, "2026-09-15T08:00:00.000Z");
});

test("override reads a local file outside the repository", () => {
  const directory = mkdtempSync(join(tmpdir(), "tracking-workout-comparison-"));
  try {
    const file = join(directory, "synthetic.json");
    writeFileSync(file, JSON.stringify(synthetic));
    assert.equal(loadComparisonWorkout(file).preview.displayName, "Running");
    assert.throws(() => loadComparisonWorkout("synthetic.json"), /absolute local path/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("health fixture serves only the selected local workout after explicit seeding", () => {
  const directory = mkdtempSync(join(tmpdir(), "tracking-health-comparison-"));
  const previousFile = process.env.E2E_WORKOUT_FILE;
  try {
    const file = join(directory, "synthetic.json");
    writeFileSync(file, JSON.stringify(synthetic));
    process.env.E2E_WORKOUT_FILE = file;
    resetHealthFixture();
    assert.deepEqual(healthFixture("/__health-workout-comparison", "POST", {}), {
      ok: true,
      profileAge: 30,
    });
    const response = healthFixture("/health/apple/workouts/reconciliation-preview", "GET", {});
    assert.equal(response && "items" in response && Array.isArray(response.items)
      ? response.items.length : 0, 1);
  } finally {
    resetHealthFixture();
    if (previousFile == null) delete process.env.E2E_WORKOUT_FILE;
    else process.env.E2E_WORKOUT_FILE = previousFile;
    rmSync(directory, { recursive: true, force: true });
  }
});
