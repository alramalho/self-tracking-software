import assert from "node:assert/strict";
import test from "node:test";

import {
  isCurrentIosNotificationRegistration,
  wantsIosNotifications,
} from "../src/native/notifications/model";
import { notificationRoute } from "../src/native/notification-routing";
import { notificationTarget } from "../src/native/notification-target";

test("migrates an enabled server preference when no local choice exists", () => {
  assert.equal(wantsIosNotifications(null, true), true);
  assert.equal(wantsIosNotifications(null, false), false);
});

test("an explicit local choice wins over stale server state", () => {
  assert.equal(wantsIosNotifications("disabled", true), false);
  assert.equal(wantsIosNotifications("enabled", false), true);
});

test("registration is current only when the enabled server token matches", () => {
  assert.equal(
    isCurrentIosNotificationRegistration(true, "new-token", "new-token"),
    true,
  );
  assert.equal(
    isCurrentIosNotificationRegistration(true, "old-token", "new-token"),
    false,
  );
  assert.equal(
    isCurrentIosNotificationRegistration(false, "new-token", "new-token"),
    false,
  );
});

test("reaction and achievement notices open their timeline cards", () => {
  assert.equal(notificationRoute("/?activityEntryId=entry-1"), "/?activityEntryId=entry-1");
  assert.equal(notificationRoute("https://app.tracking.so/?achievementPostId=post-1"), "/?achievementPostId=post-1");
  assert.equal(notificationTarget({ id: "n1", title: "Reaction", status: "PROCESSED", type: "INFO", relatedData: { activityEntryId: "entry-1" } }), "/?activityEntryId=entry-1");
});

test("only known destinations can be opened from a push", () => {
  assert.equal(notificationRoute("/chat/chat-1"), "/chat/chat-1");
  assert.equal(notificationRoute("/plan/plan-1"), "/plan/plan-1");
  assert.equal(notificationRoute("/?activityEntryId=entry-1&other=1"), null);
  assert.equal(notificationRoute("https://elsewhere.example/?activityEntryId=entry-1"), null);
});
