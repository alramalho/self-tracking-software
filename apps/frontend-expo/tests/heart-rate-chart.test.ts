import assert from "node:assert/strict";
import test from "node:test";
import { buildHeartRateChart, workoutElapsedSpan, zoneForBpm, zoneReference } from "../src/features/health/heart-rate-chart/model";
import type { HeartRateZones } from "../src/features/health/workout-types";

const ageBasedZones: HeartRateZones = {
  estimatedMaxHeartRateBpm: 190,
  source: "age_estimate",
  zone1Seconds: 10,
  zone2Seconds: 20,
  zone3Seconds: 30,
  zone4Seconds: 40,
  zone5Seconds: 50,
};

test("zone boundaries move to the upper zone at the exact threshold", () => {
  assert.equal(zoneForBpm(113.999, 190), 1);
  assert.equal(zoneForBpm(114, 190), 2);
  assert.equal(zoneForBpm(133, 190), 3);
  assert.equal(zoneForBpm(152, 190), 4);
  assert.equal(zoneForBpm(171, 190), 5);
});

test("age based workout max wins; generic provider fallback is not personalized", () => {
  assert.deepEqual(zoneReference(ageBasedZones, 36), {
    maximumForZones: 190,
    zoneSource: "workout_age_estimate",
  });
  assert.deepEqual(zoneReference({ ...ageBasedZones, source: "default", estimatedMaxHeartRateBpm: 200 }, 36), {
    maximumForZones: 184,
    zoneSource: "profile_age",
  });
  assert.deepEqual(zoneReference({ ...ageBasedZones, source: "default" }, null), {
    maximumForZones: null,
    zoneSource: null,
  });
});

test("a crossing is split at each actual percentage boundary", () => {
  const model = buildHeartRateChart([
    { elapsedSeconds: 20, bpm: 108 },
    { elapsedSeconds: 80, bpm: 180 },
  ], 100, ageBasedZones);
  assert.ok(model);
  assert.deepEqual(model.segments.map((segment) => segment.zone), [1, 2, 3, 4, 5]);
  assert.deepEqual(model.segments.slice(0, -1).map((segment) => Math.round(segment.to.bpm)), [114, 133, 152, 171]);
  assert.equal(model.points[0].elapsedSeconds, 20);
  assert.equal(model.points.at(-1)?.elapsedSeconds, 80);
  assert.ok(model.points[0].x > 20, "start is placed at its real elapsed time");
  assert.ok(model.points.at(-1)!.x < 300, "end is placed before workout finish");
});

test("long missing intervals break the line, including Garmin detail gaps", () => {
  const model = buildHeartRateChart([
    { elapsedSeconds: 10, bpm: 120 },
    { elapsedSeconds: 40, bpm: 130 },
    { elapsedSeconds: 600, bpm: 150 },
    { elapsedSeconds: 630, bpm: 152 },
  ], 900, null, 30);
  assert.ok(model);
  assert.equal(model.hasGaps, true);
  assert.ok(model.segments.every((segment) => segment.to.elapsedSeconds - segment.from.elapsedSeconds <= 30));
  assert.equal(model.maximumForZones, 190);
});

test("paused workouts retain post-pause readings on the wall-elapsed axis", () => {
  const span = workoutElapsedSpan("2026-09-15T07:00:00Z", "2026-09-15T08:00:00Z");
  assert.equal(span, 3600);
  const activeDurationSeconds = 2700;
  const model = buildHeartRateChart([
    { elapsedSeconds: 2600, bpm: 145 },
    { elapsedSeconds: 2630, bpm: 148 },
    { elapsedSeconds: 3300, bpm: 160 },
    { elapsedSeconds: 3330, bpm: 165 },
    { elapsedSeconds: 3700, bpm: 166 },
  ], span!, null, 30);
  assert.ok(model);
  assert.equal(model.elapsedSpanSeconds, 3600);
  assert.equal(model.points.length, 4);
  assert.ok(model.points.at(-1)!.elapsedSeconds > activeDurationSeconds);
  assert.ok(model.points.at(-1)!.x < 300);
  assert.equal(model.hasGaps, true);
  assert.equal(workoutElapsedSpan("bad", "2026-09-15T08:00:00Z"), null);
  assert.equal(workoutElapsedSpan("2026-09-15T08:00:00Z", "2026-09-15T07:00:00Z"), null);
});

test("missing or invalid samples never invent a graph or thresholds", () => {
  assert.equal(buildHeartRateChart([{ elapsedSeconds: 20, bpm: 130 }], 60), null);
  assert.equal(buildHeartRateChart([{ elapsedSeconds: 20, bpm: 130 }, { elapsedSeconds: 70, bpm: 140 }], 60), null);
  const model = buildHeartRateChart([
    { elapsedSeconds: 20, bpm: 130 },
    { elapsedSeconds: 40, bpm: 140 },
  ], 60);
  assert.ok(model);
  assert.equal(model.maximumForZones, null);
  assert.deepEqual(model.segments.map((segment) => segment.zone), [null]);
});
