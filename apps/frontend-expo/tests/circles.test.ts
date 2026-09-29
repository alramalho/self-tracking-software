import { test } from "node:test";
import assert from "node:assert/strict";
import { circleStatusLine, recapLine } from "../src/features/circles/model";
import { notificationRoute } from "../src/native/notification-routing";

test("recap names the top person but never who fell short", () => {
  assert.equal(
    recapLine({ weekStart: "2026-09-20", hit: 2, total: 3, topName: "Tomás", topCount: 6 }, 0),
    "2 of 3 of you hit your week. Tomás showed up most, 6 times.",
  );
  assert.equal(
    recapLine({ weekStart: "2026-09-20", hit: 5, total: 5, topName: null, topCount: 0 }, 3),
    "All 5 of you hit your week. That's 3 weeks together.",
  );
});

test("home square says how the circle's week is going", () => {
  const base = { id: "c", name: "Morning 10K", emoji: "🏃", planId: "p", hasIntro: true, pending: false, people: [] };
  assert.equal(circleStatusLine({ ...base, status: "ACTIVE", memberCount: 5, onTrack: 4, daysLeft: 2 }), "4 of 5 on track · 2 days left");
  assert.equal(circleStatusLine({ ...base, status: "FORMING", memberCount: 1, onTrack: 1, daysLeft: 5 }), "Forming · 1 of 3");
  // Until the first photo log, the square says what gets you in.
  assert.equal(circleStatusLine({ ...base, pending: true, status: "ACTIVE", memberCount: 4, onTrack: 3, daysLeft: 2 }), "Post a photo to join");
});

test("circle notifications and invite links open in the app", () => {
  assert.equal(notificationRoute("/circle/abc123"), "/circle/abc123");
  assert.equal(notificationRoute("https://app.tracking.so/circle-invite/9f1c"), "/circle-invite/9f1c");
  assert.equal(notificationRoute("/circle/abc/../../settings"), null);
});
