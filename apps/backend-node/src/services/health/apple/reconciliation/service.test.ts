import { describe, expect, it } from "vitest";
import type { Activity } from "@tsw/prisma";

import {
  canonicalActivityKind,
  canonicalWorkoutKind,
  compareWorkoutMeasurement,
  healthMeasurementForMeasure,
  suggestedActivityForWorkout,
} from "./service";

function activity(id: string, title: string, measure = "minutes"): Activity {
  return { id, title, measure, userId: "test-user", emoji: "🏃", kind: "other",
    createdAt: new Date(0), updatedAt: new Date(0), colorHex: null, deletedAt: null };
}

const RUN = { activityTypeCode: 37, activityTypeName: "running",
  distanceMeters: 5000, durationSeconds: 1800 };

describe("remembered Apple workout activity choices", () => {
  it("prefers a confirmed custom name over the generic title match", () => {
    const activities = [activity("run", "Running"), activity("custom", "Morning movement")];
    const matches = [{ activityTypeCode: 37, activityId: "custom", confirmedAt: new Date() }];
    expect(suggestedActivityForWorkout(RUN, activities, matches)?.id).toBe("custom");
  });

  it("uses the latest valid choice and never changes the supplied history", () => {
    const activities = [activity("old", "Old routine"), activity("new", "New routine")];
    const matches = [
      { activityTypeCode: 37, activityId: "old", confirmedAt: new Date(1) },
      { activityTypeCode: 37, activityId: "new", confirmedAt: new Date(2) },
    ];
    expect(suggestedActivityForWorkout(RUN, activities, matches)?.id).toBe("new");
    expect(matches[0].activityId).toBe("old");
  });

  it("does not reuse another workout type's choice", () => {
    const activities = [activity("run", "Running"), activity("gym", "Gym")];
    const matches = [{ activityTypeCode: 50, activityId: "gym", confirmedAt: new Date() }];
    expect(suggestedActivityForWorkout(RUN, activities, matches)?.id).toBe("run");
  });

  it("falls back when a saved activity is absent, deleted or has incompatible units", () => {
    const deleted = { ...activity("deleted", "Old routine"), deletedAt: new Date() };
    const activities = [activity("run", "Running"), deleted, activity("reps", "Strength", "reps")];
    for (const activityId of ["absent", "deleted", "reps"]) {
      expect(suggestedActivityForWorkout(RUN, activities,
        [{ activityTypeCode: 37, activityId, confirmedAt: new Date() }])?.id).toBe("run");
    }
  });

  it("leaves a workout without a usable activity for the create-activity flow", () => {
    expect(suggestedActivityForWorkout(RUN, [], [])).toBeNull();
  });
});

const JULY_9_RUN = {
  distanceMeters: 5884.797,
  durationSeconds: 1768.823,
};

describe("Apple Health workout reconciliation", () => {
  it("treats the July 9 6 km log as normal rounding", () => {
    const comparison = compareWorkoutMeasurement(
      JULY_9_RUN,
      6,
      "kilometers",
    );

    expect(comparison.compatible).toBe(true);
    expect(comparison.withinTolerance).toBe(true);
    expect(comparison.healthValue).toBeCloseTo(5.884797, 6);
    expect(comparison.differencePercent).toBeCloseTo(1.92, 1);
  });

  it("converts duration-based activities without guessing from distance", () => {
    const comparison = compareWorkoutMeasurement(JULY_9_RUN, 30, "minutes");

    expect(comparison.compatible).toBe(true);
    expect(comparison.withinTolerance).toBe(true);
    expect(comparison.healthValue).toBeCloseTo(29.48, 1);
  });

  it("marks reps as irreconcilable with Health workout measurements", () => {
    expect(healthMeasurementForMeasure(JULY_9_RUN, "reps")).toBeNull();
    expect(
      compareWorkoutMeasurement(JULY_9_RUN, 50, "reps").compatible,
    ).toBe(false);
  });

  it("maps legacy titles and HealthKit names to the same deterministic kind", () => {
    expect(canonicalWorkoutKind("traditional_strength_training")).toBe("gym");
    expect(canonicalActivityKind({ kind: "other", title: "Morning run" })).toBe(
      "running",
    );
    expect(canonicalWorkoutKind("running")).toBe("running");
  });
});
