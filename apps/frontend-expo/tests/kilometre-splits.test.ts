import assert from "node:assert/strict";
import { test } from "node:test";
import { kilometreSplits, splitBarPercent, splitClock } from "../src/features/health/splits/model";
import type { SplitWorkout } from "../src/features/health/splits/types";

const workout: SplitWorkout = {
  startAt: "2026-09-15T07:00:00Z",
  endAt: "2026-09-15T07:22:00Z",
  durationSeconds: 1100,
  distanceMeters: 3100,
  distanceTimeSeries: [
    { elapsedSeconds: 0, distanceMeters: 0 },
    { elapsedSeconds: 290, distanceMeters: 800 },
    { elapsedSeconds: 400, distanceMeters: 1100 },
    { elapsedSeconds: 600, distanceMeters: 1500 },
    { elapsedSeconds: 720, distanceMeters: 1500 }, // pause
    { elapsedSeconds: 840, distanceMeters: 1900 },
    { elapsedSeconds: 900, distanceMeters: 2100 },
    { elapsedSeconds: 1200, distanceMeters: 3000 },
    { elapsedSeconds: 1260, distanceMeters: 3100 },
  ],
};

test("interpolates kilometre boundaries, counts pauses and keeps the final partial kilometre", () => {
  const splits = kilometreSplits(workout);
  assert.equal(splits.length, 4);
  assert.equal(Math.round(splits[0].elapsedSeconds), 363);
  assert.equal(Math.round(splits[1].elapsedSeconds), 507);
  assert.equal(Math.round(splits[2].elapsedSeconds), 330);
  assert.equal(splits[3].distanceMeters, 100);
  assert.equal(splits[3].elapsedSeconds, 60);
  assert.equal(splits[3].paceSecondsPerKm, 600);
  assert.equal(splits[3].partial, true);
  assert.equal(splitClock(splits[3].paceSecondsPerKm), "10:00");
  assert.ok(splitBarPercent(splits[0], splits) > splitBarPercent(splits[1], splits));
  assert.ok(splitBarPercent(splits[1], splits) > splitBarPercent(splits[3], splits));
  // The partial's 1:00 over 0.10 km is compared as 10:00/km, not as a 1:00 split.
  assert.ok(splitBarPercent(splits[3], splits) < splitBarPercent(splits[2], splits));
  assert.equal(splitBarPercent(splits[3], splits),
    Math.min(...splits.map((split) => split.paceSecondsPerKm)) / 600 * 100);
});

test("does not turn aggregate pace or an incomplete trace into fictitious splits", () => {
  assert.deepEqual(kilometreSplits({ ...workout, distanceTimeSeries: null }), []);
  assert.deepEqual(kilometreSplits({ ...workout, distanceTimeSeries: workout.distanceTimeSeries!.slice(0, 5) }), []);
  assert.deepEqual(kilometreSplits({ ...workout, distanceTimeSeries: [
    { elapsedSeconds: 0, distanceMeters: 0 },
    { elapsedSeconds: 100, distanceMeters: 1200 },
    { elapsedSeconds: 200, distanceMeters: 1150 },
    { elapsedSeconds: 1260, distanceMeters: 3100 },
  ] }), []);
});

test("rejects a trace that starts too late or exceeds the workout window", () => {
  assert.deepEqual(kilometreSplits({ ...workout, distanceTimeSeries: [
    { elapsedSeconds: 300, distanceMeters: 500 },
    { elapsedSeconds: 1260, distanceMeters: 3100 },
  ] }), []);
  assert.deepEqual(kilometreSplits({ ...workout, distanceTimeSeries: [
    { elapsedSeconds: 0, distanceMeters: 0 },
    { elapsedSeconds: 1500, distanceMeters: 3100 },
  ] }), []);
});

test("does not interpolate a kilometre boundary across a missing time interval", () => {
  assert.deepEqual(kilometreSplits({ ...workout, distanceTimeSeries: [
    { elapsedSeconds: 0, distanceMeters: 0 },
    { elapsedSeconds: 300, distanceMeters: 800 },
    { elapsedSeconds: 900, distanceMeters: 1500 },
    { elapsedSeconds: 1260, distanceMeters: 3100 },
  ] }), []);
});

test("rejects endpoint-only aggregate data instead of producing ten identical fake splits", () => {
  assert.deepEqual(kilometreSplits({
    startAt: "2026-09-15T07:00:00Z",
    endAt: "2026-09-15T08:00:00Z",
    durationSeconds: 3600,
    distanceMeters: 10_000,
    distanceTimeSeries: [
      { elapsedSeconds: 0, distanceMeters: 0 },
      { elapsedSeconds: 3600, distanceMeters: 10_000 },
    ],
  }), []);
});

test("rejects a device distance reset rather than joining unrelated segments", () => {
  assert.deepEqual(kilometreSplits({ ...workout, distanceTimeSeries: [
    { elapsedSeconds: 0, distanceMeters: 0 },
    { elapsedSeconds: 300, distanceMeters: 1000 },
    { elapsedSeconds: 600, distanceMeters: 100 },
    { elapsedSeconds: 1260, distanceMeters: 3100 },
  ] }), []);
});

test("coalesces simultaneous provider samples without losing a kilometre boundary", () => {
  const result = kilometreSplits({ ...workout, distanceTimeSeries: [
    { elapsedSeconds: 0, distanceMeters: 0 },
    { elapsedSeconds: 300, distanceMeters: 700 },
    { elapsedSeconds: 300, distanceMeters: 1000 },
    { elapsedSeconds: 600, distanceMeters: 2000 },
    { elapsedSeconds: 1200, distanceMeters: 3000 },
    { elapsedSeconds: 1260, distanceMeters: 3100 },
  ] });
  assert.equal(result[0].elapsedSeconds, 300);
  assert.equal(result.length, 4);
});
