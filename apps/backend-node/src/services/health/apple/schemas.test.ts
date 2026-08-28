import { describe, expect, it } from "vitest";

import { appleHealthSyncBatchSchema } from "./schemas";

const validBatch = {
  deviceId: "ios-installation-id",
  requestedDataTypes: ["step_count", "workout", "sleep_analysis"],
  initialSyncStartAt: "2026-01-01T00:00:00.000Z",
  syncStartedAt: "2026-07-29T10:00:00.000Z",
  isFirstBatch: true,
  isFinalBatch: true,
  dailyMetrics: [
    {
      localDate: "2026-07-28",
      metric: "step_count",
      aggregation: "sum",
      value: 10_250,
      unit: "count",
      sampleCount: 8,
    },
  ],
  workouts: [
    {
      externalId: "D5FB9308-5E7D-4B12-84AF-40EB2D9BAB7D",
      activityTypeCode: 37,
      activityTypeName: "running",
      startAt: "2026-07-28T07:00:00.000Z",
      endAt: "2026-07-28T07:30:00.000Z",
      durationSeconds: 1_800,
      sourceBundleId: "com.apple.health",
    },
  ],
  sleepSamples: [
    {
      externalId: "44860FE7-FB0E-462A-A59B-A7CA935347D2",
      stageCode: 4,
      stage: "asleep_deep",
      startAt: "2026-07-28T01:00:00.000Z",
      endAt: "2026-07-28T02:00:00.000Z",
      sourceBundleId: "com.apple.health",
    },
  ],
  deletedWorkoutIds: [],
  deletedSleepSampleIds: [],
};

describe("appleHealthSyncBatchSchema", () => {
  it("accepts a bounded correlation-ready sync batch", () => {
    const result = appleHealthSyncBatchSchema.safeParse(validBatch);

    expect(result.success).toBe(true);
  });

  it("rejects impossible local calendar dates", () => {
    const result = appleHealthSyncBatchSchema.safeParse({
      ...validBatch,
      dailyMetrics: [
        {
          ...validBatch.dailyMetrics[0],
          localDate: "2026-02-30",
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("rejects reversed workout intervals", () => {
    const result = appleHealthSyncBatchSchema.safeParse({
      ...validBatch,
      workouts: [
        {
          ...validBatch.workouts[0],
          endAt: "2026-07-28T06:30:00.000Z",
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("rejects unsupported metric names to prevent unbounded cardinality", () => {
    const result = appleHealthSyncBatchSchema.safeParse({
      ...validBatch,
      dailyMetrics: [
        {
          ...validBatch.dailyMetrics[0],
          metric: "arbitrary_metric",
        },
      ],
    });

    expect(result.success).toBe(false);
  });
});
