import { describe, expect, it } from "vitest";

import {
  difficultyFromAppleEffort,
  workoutEffortInsight,
  workoutMetadata,
} from "./effort";

describe("Apple workout effort", () => {
  it.each([
    [1, "very_easy"],
    [2, "very_easy"],
    [3, "easy"],
    [5, "moderate"],
    [7, "hard"],
    [9, "very_hard"],
    [10, "very_hard"],
  ] as const)("maps score %s to %s", (score, difficulty) => {
    expect(difficultyFromAppleEffort(score)).toBe(difficulty);
  });

  it("prefers the effort the person recorded over Apple's estimate", () => {
    expect(
      workoutEffortInsight({
        workoutEffortScore: 8,
        estimatedWorkoutEffortScore: 4,
      }),
    ).toEqual({ score: 8, source: "user", difficulty: "hard" });
  });

  it("uses Apple's estimate when no reported effort exists", () => {
    expect(workoutEffortInsight({ estimatedWorkoutEffortScore: 6.2 })).toEqual({
      score: 6.2,
      source: "apple_estimated",
      difficulty: "hard",
    });
  });

  it("keeps valid heart-rate summaries without inventing effort", () => {
    const metadata = workoutMetadata({
      averageHeartRateBpm: 151.4,
      maximumHeartRateBpm: 177,
    });
    expect(metadata).toEqual({
      averageHeartRateBpm: 151.4,
      maximumHeartRateBpm: 177,
    });
    expect(workoutEffortInsight(metadata)).toBeNull();
  });

  it("keeps running heart-rate zones and elevation metadata", () => {
    expect(
      workoutMetadata({
        elevationAscendedMeters: 96,
        elevationDescendedMeters: 91,
        heartRateZones: {
          estimatedMaxHeartRateBpm: 190,
          source: "age_estimate",
          zone1Seconds: 120,
          zone2Seconds: 600,
          zone3Seconds: 900,
          zone4Seconds: 600,
          zone5Seconds: 120,
        },
      }),
    ).toMatchObject({
      elevationAscendedMeters: 96,
      elevationDescendedMeters: 91,
      heartRateZones: {
        estimatedMaxHeartRateBpm: 190,
        source: "age_estimate",
        zone3Seconds: 900,
      },
    });
  });
});
