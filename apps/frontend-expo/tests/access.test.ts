import assert from "node:assert/strict";
import test from "node:test";

import {
  accessRequests,
  buttonLabel,
  coachNeedsAppleHealth,
  healthStatus,
  locationStatus,
  notificationStatus,
  pendingKinds,
  shownItems,
  statusLabel,
} from "../src/features/access/model";

test("notifications switched off inside tracking.so still need a yes", () => {
  assert.equal(notificationStatus("granted", false), "pending");
  assert.equal(notificationStatus("granted", true), "allowed");
  assert.equal(notificationStatus("undetermined", true), "pending");
  assert.equal(notificationStatus("denied", true), "off");
});

test("location and Apple Health map to the checklist states", () => {
  assert.equal(locationStatus("undetermined"), "pending");
  assert.equal(locationStatus("granted"), "allowed");
  assert.equal(locationStatus("denied"), "off");
  assert.equal(healthStatus(false, false), "unavailable");
  assert.equal(healthStatus(true, false), "pending");
  assert.equal(healthStatus(true, true), "allowed");
});

test("the checklist hides what this phone can't do and asks only what's pending", () => {
  const request = accessRequests.appleHealth();
  const statuses = { health: "unavailable", notifications: "pending" } as const;
  assert.deepEqual(
    shownItems(request.items, statuses).map((item) => item.kind),
    ["notifications"],
  );
  assert.deepEqual(pendingKinds(request.items, { health: "allowed", notifications: "off" }), []);
});

test("the only button says Continue, then Done — never Allow (Guideline 5.1.1(iv))", () => {
  const items = accessRequests.coach("Helly", true).items;
  assert.equal(buttonLabel(items, { notifications: "pending", health: "allowed" }), "Continue");
  assert.equal(buttonLabel(items, { notifications: "off", health: "allowed" }), "Done");
  for (const request of Object.values(accessRequests)) {
    const text = JSON.stringify(request("Helly", true));
    assert.doesNotMatch(text, /\bAllow\b/);
  }
});

test("status pills: Allowed, Done for Apple Health, Off, nothing while pending", () => {
  assert.equal(statusLabel("notifications", "allowed"), "Allowed");
  assert.equal(statusLabel("health", "allowed"), "Done");
  assert.equal(statusLabel("location", "off"), "Off");
  assert.equal(statusLabel("location", "pending"), null);
});

test("the coach asks for Apple Health only for watch data and never from Garmin people", () => {
  assert.equal(coachNeedsAppleHealth({ workouts: true, sleep: false }, false), true);
  assert.equal(coachNeedsAppleHealth({ workouts: false, sleep: true }, false), true);
  assert.equal(coachNeedsAppleHealth({ workouts: false, sleep: false }, false), false);
  assert.equal(coachNeedsAppleHealth({ workouts: true, sleep: true }, true), false);
  assert.deepEqual(
    accessRequests.coach("Oli", false).items.map((item) => item.kind),
    ["notifications"],
  );
  assert.equal(accessRequests.coach("Oli", true).title, "Oli needs access");
});
