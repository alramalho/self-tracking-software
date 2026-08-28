import { describe, expect, it } from "vitest";

import {
  canonicalActivityKind,
  canonicalWorkoutKind,
  compareWorkoutMeasurement,
  healthMeasurementForMeasure,
} from "./service";

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
