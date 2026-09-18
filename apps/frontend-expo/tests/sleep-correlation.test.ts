import assert from "node:assert/strict";
import test from "node:test";
import {
  estimatedSleepQuality,
  sleepCorrelation,
} from "../src/features/metrics/model";
import type { SleepScore } from "../src/features/health/sleep-types";
import type { MetricEntry } from "../src/core/types";

const night = (date: string, total: number | null) =>
  ({ date, total }) as SleepScore;

const checkIn = (date: string, rating: number) =>
  ({
    id: `entry-${date}`,
    metricId: "energy",
    rating,
    createdAt: `${date}T00:00:00.000Z`,
  }) as MetricEntry;

test("sleep pairs each check-in with the night ending that morning", () => {
  const scores = [
    night("2026-09-15", 90),
    night("2026-09-14", 60),
    night("2026-09-13", 30),
  ];
  const entries = [
    checkIn("2026-09-15", 5),
    checkIn("2026-09-14", 3),
    checkIn("2026-09-13", 1),
  ];
  const result = sleepCorrelation(scores, entries);
  assert.equal(result?.sampleSize, 3);
  // Pearson([90,60,30],[5,3,1]) === 1.
  assert.ok(Math.abs((result?.correlation ?? 0) - 1) < 1e-12);
});

test("nights without a total never count as zero and are skipped", () => {
  const scores = [
    night("2026-09-15", 90),
    night("2026-09-14", null),
    night("2026-09-13", 30),
    night("2026-09-12", 70),
  ];
  const entries = [
    checkIn("2026-09-15", 5),
    checkIn("2026-09-14", 1),
    checkIn("2026-09-13", 2),
    checkIn("2026-09-12", 4),
  ];
  const result = sleepCorrelation(scores, entries);
  assert.equal(result?.sampleSize, 3);
  assert.equal(result?.higherAverage, 5);
  assert.equal(result?.lowerAverage, 3);
});

test("fewer than three paired nights show the row without a correlation", () => {
  const result = sleepCorrelation(
    [night("2026-09-15", 90)],
    [checkIn("2026-09-15", 4)],
  );
  assert.equal(result?.correlation, null);
  assert.equal(result?.comparable, false);
  assert.equal(result?.sampleSize, 1);
});

test("no nights or no check-ins leave sleep out of the list", () => {
  assert.equal(sleepCorrelation([], [checkIn("2026-09-15", 4)]), null);
  assert.equal(sleepCorrelation([night("2026-09-15", 90)], []), null);
});

test("out-of-range check-ins are excluded from the 1-5 band averages", () => {
  // A historical or imported rating of 8 stays in the activity correlation
  // history but would draw a band bar past the end of its 1-5 track.
  const scores = [
    night("2026-09-17", 90),
    night("2026-09-15", 60),
    night("2026-09-13", 30),
  ];
  const result = sleepCorrelation(scores, [
    checkIn("2026-09-17", 8),
    checkIn("2026-09-15", 3),
    checkIn("2026-09-13", 1),
  ]);
  assert.equal(result?.sampleSize, 2);
  assert.equal(result?.comparable, false);
  assert.equal(result?.correlation, null);
  assert.ok((result?.bands ?? []).every((band) => (band.average ?? 0) <= 5));
});

test("a learning night is estimated from the components it measured", () => {
  // Duration 50/50 and interruptions 10/20 exist, consistency is still being
  // learned, so the estimate uses only the 70 points' worth of available components.
  const learning = {
    date: "2026-09-15",
    total: null,
    durationPoints: 50,
    consistencyPoints: null,
    interruptionPoints: 10,
  } as SleepScore;
  assert.equal(estimatedSleepQuality(learning), 86);
  assert.equal(estimatedSleepQuality(night("2026-09-15", 91)), 91);
  assert.equal(estimatedSleepQuality(night("2026-09-15", null)), null);
});

test("learning nights correlate through their estimate and are labeled", () => {
  const scores = [
    {
      date: "2026-09-15",
      total: null,
      durationPoints: 50,
      consistencyPoints: null,
      interruptionPoints: 20,
    },
    {
      date: "2026-09-14",
      total: null,
      durationPoints: 20,
      consistencyPoints: null,
      interruptionPoints: 5,
    },
    {
      date: "2026-09-13",
      total: null,
      durationPoints: 10,
      consistencyPoints: 6,
      interruptionPoints: 4,
    },
  ] as SleepScore[];
  const entries = [
    checkIn("2026-09-15", 5),
    checkIn("2026-09-14", 2),
    checkIn("2026-09-13", 1),
  ];
  const result = sleepCorrelation(scores, entries);
  assert.equal(result?.comparable, true);
  assert.equal(result?.estimatedNights, 3);
  assert.ok((result?.correlation ?? 0) > 0.9);
});

test("sleep bands report a count so empty bands stay labeled", () => {
  const scores = [
    night("2026-09-15", 90),
    night("2026-09-14", 88),
    night("2026-09-13", 50),
  ];
  const entries = [
    checkIn("2026-09-15", 5),
    checkIn("2026-09-14", 4),
    checkIn("2026-09-13", 2),
  ];
  const result = sleepCorrelation(scores, entries);
  assert.deepEqual(
    result?.bands.map((band) => [band.label, band.count]),
    [
      ["Good nights", 2],
      ["Fair nights", 0],
      ["Poor nights", 1],
    ],
  );
});
