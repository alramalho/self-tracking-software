import test from "node:test";
import assert from "node:assert/strict";
import { messagePlanIds } from "../src/features/messages/plan-context";
import { notificationRoute } from "../src/native/notification-routing";
import { notificationTarget } from "../src/native/notification-target";

test("new shared reviews and earlier linked plan messages remain in the right filters", () => {
  assert.deepEqual(messagePlanIds({ id: "combined", role: "COACH", createdAt: "2026-09-23", content: "Keep the same goals.", planIds: ["running", "meditation"] }), ["running", "meditation"]);
  assert.deepEqual(messagePlanIds({ id: "legacy", role: "COACH", createdAt: "2026-09-23", content: "Review {{plan:running|your running plan}}.", planId: "running" }), ["running"]);
  assert.deepEqual(messagePlanIds({ id: "general", role: "COACH", createdAt: "2026-09-23", content: "Hello" }), []);
});
test("a coach notification retains the exact message and plan when opened from push or the notification list", () => {
  const url = "/chat/coach-main?messageId=review-1&planId=running";
  assert.equal(notificationRoute(`trackingso://${url.slice(1)}`), url);
  assert.equal(notificationTarget({ id: "coach-review", title: "Your coach", type: "COACH", status: "PROCESSED", relatedData: { url, chatId: "coach-main", messageId: "review-1", planIds: ["running"] } }), url);
});
