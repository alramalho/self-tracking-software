import assert from "node:assert/strict";
import test from "node:test";

import { paceChange, workoutTrends } from "../src/features/health/workout-model";
import type { WorkoutReconciliationPreviewItem } from "../src/features/health/workout-types";

const workout = (
  id: string,
  startAt: string,
  title: string,
  minutes: number,
  km: number | null,
) =>
  ({
    healthWorkout: {
      id,
      displayName: title,
      startAt,
      durationSeconds: minutes * 60,
      distanceMeters: km == null ? null : km * 1000,
    },
    resolved: { activityEntryId: id, linkedActivity: { title, emoji: "🏃", measure: "", quantity: 1 } },
  }) as unknown as WorkoutReconciliationPreviewItem;

const now = new Date("2026-11-08T22:00:00");

test("runs are summed per week, this week last, and pace compares recent runs with the ones before", () => {
  const items = [
    workout("a", "2026-11-05T08:00:00", "running", 25, 5), // this week, 5:00/km
    workout("b", "2026-11-03T08:00:00", "running", 25, 5),
    workout("c", "2026-10-31T08:00:00", "running", 50, 10),
    workout("d", "2026-10-27T08:00:00", "running", 33, 6), // 5:30/km
    workout("e", "2026-10-15T08:00:00", "running", 33, 6),
    workout("f", "2026-10-08T08:00:00", "running", 33, 6),
    workout("g", "2026-10-11T08:00:00", "Hiking", 145, null),
  ];
  const [running, ...rest] = workoutTrends(items, now);
  assert.equal(running.title, "Running");
  assert.equal(running.unit, "km");
  assert.equal(running.weeks.length, 8);
  assert.equal(running.weeks[7].start, "2026-11-02");
  assert.equal(running.weeks[7].value, 10);
  assert.equal(running.weeks[6].value, 16);
  assert.equal(running.count, 6);
  assert.equal(running.pace?.recent, 300);
  assert.equal(paceChange(running.pace!), "30 s faster than before");
  assert.equal(rest.length, 0, "a single hike is not a trend");
});

test("activities without distance count minutes and show no pace", () => {
  const items = [
    workout("a", "2026-11-04T08:00:00", "Gym", 40, null),
    workout("b", "2026-10-20T08:00:00", "Gym", 50, null),
  ];
  const [gym] = workoutTrends(items, now);
  assert.equal(gym.unit, "min");
  assert.equal(gym.weeks[7].value, 40);
  assert.equal(gym.pace, null);
});
