import assert from "node:assert/strict";
import test from "node:test";

import type { HealthDailyMetricRecord } from "../src/features/health/daily-types";
import {
  baselineAverage,
  formatBaseline,
  formatVitalValue,
  latestRecord,
} from "../src/features/health/daily-model";

function record(
  localDate: string,
  value: number,
  metric: HealthDailyMetricRecord["metric"] = "resting_heart_rate",
): HealthDailyMetricRecord {
  return {
    localDate,
    metric,
    aggregation: metric === "resting_heart_rate" ? "most_recent" : "average",
    value,
    unit: metric === "resting_heart_rate" ? "bpm" : "ms",
    provider: "apple_health",
    sourceName: "Apple Watch",
  };
}

test("health vitals use the latest reading and a seven-day baseline", () => {
  const records = [
    record("2026-09-08", 60),
    record("2026-09-09", 59),
    record("2026-09-10", 58),
    record("2026-09-11", 59),
    record("2026-09-12", 57),
    record("2026-09-13", 58),
    record("2026-09-14", 57),
    record("2026-09-15", 55),
  ];

  assert.equal(latestRecord(records, "resting_heart_rate")?.value, 55);
  assert.ok(Math.abs((baselineAverage(records, "resting_heart_rate") ?? 0) - 58.2857) < 0.001);
  assert.equal(
    formatBaseline(latestRecord(records, "resting_heart_rate"), baselineAverage(records, "resting_heart_rate")),
    "-3 vs 7-day average",
  );
  assert.equal(formatVitalValue(latestRecord(records, "resting_heart_rate")), "55 bpm");
});

test("health vitals format respiratory rate and missing readings safely", () => {
  const respiratory = record("2026-09-15", 14.6, "respiratory_rate");
  assert.equal(formatVitalValue(respiratory), "14.6 /min");
  assert.equal(formatVitalValue(null), "—");
  assert.equal(formatBaseline(respiratory, null), "No usual range yet");
});
