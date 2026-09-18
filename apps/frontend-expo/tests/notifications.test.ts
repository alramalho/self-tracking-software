import assert from "node:assert/strict";
import test from "node:test";

import {
  isCurrentIosNotificationRegistration,
  wantsIosNotifications,
} from "../src/native/notifications/model";

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
