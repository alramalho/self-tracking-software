import assert from "node:assert/strict";
import test from "node:test";
import type { ActivityEntry } from "../src/core/types";
import {
  activityEntryMeasurement,
  appleHealthDuration,
} from "../src/features/timeline/entry-presentation";

function entry(overrides: Partial<ActivityEntry> = {}): ActivityEntry {
  return {
    id: "entry-1",
    activityId: "activity-1",
    userId: "user-1",
    datetime: "2026-09-08T17:31:00.000Z",
    quantity: 6,
    createdAt: "2026-09-08T17:31:00.000Z",
    ...overrides,
  };
}

test("Apple Health distance is displayed precisely while quantity remains integral", () => {
  const imported = entry({
    source: "apple_health",
    distanceMeters: 6_300,
    durationSeconds: 2_340,
  });

  assert.equal(activityEntryMeasurement(imported, "kilometers"), "6.3 km");
  assert.equal(appleHealthDuration(imported, "kilometers"), "39 min");
  assert.equal(imported.quantity, 6);
});

test("linked Health records can show Watch precision without changing manual entry input", () => {
  const linked = entry({
    source: "apple_health_linked",
    distanceMeters: 5_884.797,
    durationSeconds: 1_769,
  });

  assert.equal(activityEntryMeasurement(linked, "kilometers"), "5.9 km");
  assert.equal(appleHealthDuration(linked, "kilometers"), "29 min");
});

test("manual entries keep their existing integer presentation", () => {
  const manual = entry();

  assert.equal(activityEntryMeasurement(manual, "kilometers"), "6 kilometers");
  assert.equal(appleHealthDuration(manual, "kilometers"), null);
});

test("time-based Health activities do not repeat duration metadata", () => {
  const imported = entry({ source: "apple_health", durationSeconds: 2_340 });

  assert.equal(activityEntryMeasurement(imported, "minutes"), "39 min");
  assert.equal(appleHealthDuration(imported, "minutes"), null);
});
