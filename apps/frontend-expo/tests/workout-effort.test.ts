import assert from "node:assert/strict";
import test from "node:test";

import {
  defaultWorkoutSelection,
  workoutEffortLabel,
  workoutEffortSummary,
  workoutHeartRateSummary,
  workoutNeedsMatchChoice,
} from "../src/features/health/workout-model";
import type {
  HealthWorkoutPreview,
  WorkoutReconciliationPreviewItem,
} from "../src/features/health/workout-types";

function workout(
  values: Partial<HealthWorkoutPreview>,
): HealthWorkoutPreview {
  return {
    id: "workout",
    activityTypeName: "running",
    displayName: "Running",
    startAt: "2026-09-15T07:00:00.000Z",
    endAt: "2026-09-15T07:39:00.000Z",
    durationSeconds: 2_340,
    distanceMeters: 6_300,
    activeEnergyKcal: 430,
    sourceName: "Apple Watch",
    deviceName: "Apple Watch",
    timezone: "Europe/Lisbon",
    ...values,
  };
}

test("shows Apple's estimate with the average heart rate", () => {
  assert.equal(
    workoutEffortSummary(
      workout({
        difficulty: "moderate",
        effortSource: "apple_estimated",
        averageHeartRateBpm: 151.4,
      }),
    ),
    "Watch estimate · Moderate · Apple Health · 151 bpm average",
  );
  assert.equal(
    workoutEffortLabel(
      workout({ difficulty: "moderate", effortSource: "apple_estimated" }),
    ),
    "Watch estimate · Moderate",
  );
  assert.equal(
    workoutHeartRateSummary(workout({ averageHeartRateBpm: 151.4 })),
    "Apple Health · 151 bpm average",
  );
});

test("identifies an effort the person recorded", () => {
  assert.equal(
    workoutEffortSummary(
      workout({ difficulty: "hard", effortSource: "user" }),
    ),
    "Your effort · Hard",
  );
});

test("shows heart rate without inventing an effort level", () => {
  assert.equal(
    workoutEffortSummary(workout({ averageHeartRateBpm: 142 })),
    "Apple Health · 142 bpm average",
  );
});

function reconciliationItem(
  values: Partial<WorkoutReconciliationPreviewItem> = {},
): WorkoutReconciliationPreviewItem {
  return {
    healthWorkout: workout({}),
    category: "match",
    confidence: 0.9,
    mismatches: [],
    candidates: [
      {
        activityEntryId: "best-match",
        activityId: "running",
        activityTitle: "Running",
        activityEmoji: "🏃",
        activityMeasure: "kilometers",
        quantity: 6,
        datetime: "2026-09-15T07:10:00.000Z",
        timezone: "Europe/Lisbon",
        distanceMeters: 6_000,
        durationSeconds: 2_340,
        score: 105,
        timeDifferenceMinutes: 10,
        comparison: {
          compatible: true,
          healthValue: 6.3,
          healthUnit: "kilometers",
          trackingValue: 6,
          trackingUnit: "kilometers",
          differencePercent: 5,
          withinTolerance: false,
        },
      },
    ],
    suggestedActivity: null,
    recommendedAction: null,
    resolved: null,
    ...values,
  };
}

test("selects the strongest candidate when only its quantity differs", () => {
  const item = reconciliationItem({
    mismatches: [
      {
        code: "value_mismatch",
        severity: "conflict",
        label: "Apple Health and tracking.so values differ",
      },
    ],
  });

  assert.equal(workoutNeedsMatchChoice(item), false);
  assert.equal(defaultWorkoutSelection(item), "entry:best-match");
});

test("requires a choice for genuinely ambiguous or incompatible matches", () => {
  for (const code of [
    "ambiguous_match",
    "possible_duplicate",
    "unit_incompatible",
  ] as const) {
    const item = reconciliationItem({
      mismatches: [{ code, severity: "conflict", label: code }],
    });
    assert.equal(workoutNeedsMatchChoice(item), true);
    assert.equal(defaultWorkoutSelection(item), "");
  }
});
