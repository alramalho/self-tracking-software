import assert from "node:assert/strict";
import test from "node:test";
import {
  correlations,
  correlationAppearance,
} from "../src/features/metrics/model";
import type { Activity, ActivityEntry, MetricEntry } from "../src/core/types";
const activity = {
  id: "gym",
  title: "Gym",
  emoji: "🏋️",
  measure: "sessions",
  userId: "user",
} as Activity;
test("correlations retain historical numeric scales and count check-ins with preceding activity", () => {
  const metrics = Array.from(
    { length: 8 },
    (_, i) =>
      ({
        id: `m${i}`,
        metricId: "energy",
        rating: i + 1,
        createdAt: new Date(Date.UTC(2025, 9, 1 + i, 12)).toISOString(),
      }) as MetricEntry,
  );
  const entries = Array.from(
    { length: 4 },
    (_, i) =>
      ({
        id: `a${i}`,
        activityId: "gym",
        userId: "user",
        quantity: 1,
        datetime: new Date(Date.UTC(2025, 9, 5 + i, 8)).toISOString(),
        createdAt: new Date(Date.UTC(2025, 9, 5 + i, 8)).toISOString(),
      }) as ActivityEntry,
  );
  const result = correlations(metrics, [activity], entries)[0];
  assert.equal(result.sampleSize, 4);
  // Pearson([1..8], [0,0,0,0,1,1,1,1]) = 4/sqrt(21).
  assert.ok(Math.abs(result.correlation - 4 / Math.sqrt(21)) < 1e-12);
});
test("post-cutoff check-ins exclude activities logged afterward, while historical behavior is preserved", () => {
  const metrics = Array.from(
    { length: 8 },
    (_, i) =>
      ({
        id: `m${i}`,
        metricId: "energy",
        rating: (i % 5) + 1,
        createdAt: new Date(Date.UTC(2026, 8, 1 + i, 12)).toISOString(),
      }) as MetricEntry,
  );
  const late = {
    id: "late",
    activityId: "gym",
    quantity: 1,
    userId: "user",
    datetime: "2026-09-01T08:00:00Z",
    createdAt: "2026-09-01T13:00:00Z",
  } as ActivityEntry;
  assert.deepEqual(correlations(metrics, [activity], [late]), []);
  const onTime = { ...late, createdAt: "2026-09-01T09:00:00Z" };
  assert.equal(correlations(metrics, [activity], [onTime])[0].sampleSize, 1);
});
test("reliability and neutral magnitude use the PWA thresholds", () => {
  for (const [count, label] of [
    [4, "Insufficient"],
    [5, "Weak"],
    [14, "Weak"],
    [15, "Medium"],
    [29, "Medium"],
    [30, "Confident"],
  ] as const)
    assert.equal(correlationAppearance(0.16, count).label, label);
  assert.equal(correlationAppearance(0.09, 30).color, "#9ca3af");
  assert.equal(correlationAppearance(-0.15, 5).color, "#ef4444");
  assert.equal(correlationAppearance(0.16, 20).color, "#22c55e");
  assert.equal(correlationAppearance(0.16, 2).insufficient, true);
});
