import { describe, expect, it } from "vitest";

import { normalizeActivityDetail, normalizeGarminSummary } from "./normalization";

describe("Garmin summary normalization", () => {
  it("normalizes daily metrics from a grouped payload", () => {
    const result = normalizeGarminSummary("dailies", {
      dailies: [
        {
          summaryId: "daily-2026-09-17",
          calendarDate: "2026-09-17",
          steps: 12_345,
          activeKilocalories: 642,
          distanceInMeters: 8_765,
          averageHeartRateInBeatsPerMinute: 71,
          timeOffsetHeartRateSamples: { "0": 62, "3600": 80 },
        },
      ],
    });

    expect(result.dailyMetrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          localDate: "2026-09-17",
          metric: "step_count",
          value: 12_345,
          unit: "count",
        }),
        expect.objectContaining({
          localDate: "2026-09-17",
          metric: "heart_rate_average",
          value: 71,
          unit: "bpm",
        }),
      ]),
    );
    expect(result.summaryTypes).toEqual(["dailies"]);
  });

  it("normalizes sleep durations, score, and sleep stages", () => {
    const result = normalizeGarminSummary("sleeps", [
      {
        summaryId: "sleep-2026-09-17",
        calendarDate: "2026-09-17",
        startTimeInSeconds: 1_758_070_800,
        durationInSeconds: 28_800,
        deepSleepDurationInSeconds: 5_400,
        lightSleepDurationInSeconds: 16_200,
        remSleepInSeconds: 7_200,
        awakeDurationInSeconds: 600,
        overallSleepScore: { value: 84 },
        sleepLevelsMap: {
          deep: [
            {
              startTimeInSeconds: 1_758_070_800,
              endTimeInSeconds: 1_758_076_200,
            },
          ],
          rem: [
            {
              startTimeInSeconds: 1_758_076_200,
              endTimeInSeconds: 1_758_083_400,
            },
          ],
        },
      },
    ]);

    expect(result.dailyMetrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ metric: "sleep_deep", value: 5_400 }),
        expect.objectContaining({ metric: "sleep_rem", value: 7_200 }),
        expect.objectContaining({ metric: "sleep_score", value: 84 }),
      ]),
    );
    expect(result.sleepSamples).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stage: "asleep_deep", stageCode: 4 }),
        expect.objectContaining({ stage: "asleep_rem", stageCode: 3 }),
      ]),
    );
  });

  it("combines an activity summary with detailed heart rate and route samples", () => {
    const start = 1_758_070_800;
    const summary = {
      summaryId: "activity-summary-1",
      activityId: "activity-1",
      startTimeInSeconds: start,
      durationInSeconds: 600,
      activityType: "RUNNING",
      distanceInMeters: 2_000,
      averageHeartRateInBeatsPerMinute: 148,
      maxHeartRateInBeatsPerMinute: 177,
    };
    const result = normalizeGarminSummary("activities", [summary]);
    const detail = normalizeGarminSummary("activityDetails", {
      activityId: "activity-1",
      summary,
      metricDescriptors: [
        { key: "directTimestamp" },
        { key: "directHeartRate" },
        { key: "latitudeInDegree" },
        { key: "longitudeInDegree" },
        { key: "totalDistanceInMeters" },
        { key: "elevationInMeters" },
      ],
      samples: [
        [start, 140, 38.72, -9.14, 0, 20],
        [(start + 300) * 1000, 156, 38.721, -9.141, 1_000, 25],
      ],
    });

    expect(result.workouts[0]).toMatchObject({
      externalId: "activity-1",
      activityTypeName: "RUNNING",
      distanceMeters: 2_000,
    });
    expect(detail.workouts[0]).toMatchObject({
      externalId: "activity-1",
      metadata: expect.objectContaining({
        averageHeartRateBpm: 148,
        maximumHeartRateBpm: 177,
        heartRateSeries: [
          { elapsedSeconds: 0, bpm: 140 },
          { elapsedSeconds: 300, bpm: 156 },
        ],
        distanceTimeSeries: [
          { elapsedSeconds: 0, distanceMeters: 0 },
          { elapsedSeconds: 300, distanceMeters: 1000 },
        ],
        route: expect.arrayContaining([
          expect.objectContaining({ latitude: 38.72, longitude: -9.14 }),
        ]),
      }),
    });
  });

  it("does not infer elapsed splits from pause-excluding timer samples", () => {
    const detail = normalizeActivityDetail({
      activityId: "timer-only",
      summary: { activityId: "timer-only", startTimeInSeconds: 1_758_070_800 },
      samples: [
        { timerDurationInSeconds: 300, totalDistanceInMeters: 1000 },
        { timerDurationInSeconds: 600, totalDistanceInMeters: 2000 },
      ],
    });
    expect(detail?.distanceTimeSeries).toBeUndefined();
  });

  it("normalizes millisecond timestamps before pairing Garmin time and distance", () => {
    const start = 1_758_070_800;
    const detail = normalizeActivityDetail({
      activityId: "millisecond-clock",
      summary: { activityId: "millisecond-clock", startTimeInSeconds: start * 1000 },
      samples: [
        { directTimestamp: start * 1000, totalDistanceInMeters: 0 },
        { directTimestamp: (start + 300) * 1000, totalDistanceInMeters: 1000 },
      ],
    });
    expect(detail?.distanceTimeSeries).toEqual([
      { elapsedSeconds: 0, distanceMeters: 0 },
      { elapsedSeconds: 300, distanceMeters: 1000 },
    ]);
  });
});
