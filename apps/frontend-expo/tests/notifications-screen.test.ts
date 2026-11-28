import assert from "node:assert/strict";
import test from "node:test";

import {
  notificationActor,
  notificationText,
  shownNotifications,
  splitClosingEmoji,
  splitSections,
  timeAgo,
} from "../src/features/notifications/model";
import type { AppNotification } from "../src/features/social/types";

const notice = (fields: Partial<AppNotification>): AppNotification => ({
  id: "n",
  title: "",
  status: "PROCESSED",
  type: "INFO",
  ...fields,
});

test("a reaction shows the reactor and lifts the emoji onto the avatar", () => {
  const reaction = notice({
    message: "@liocas reacted to your activity with 🚀",
    relatedData: { reactorPicture: "https://x/p.png", reactorName: "Lia", reactorUsername: "liocas" },
  });
  assert.deepEqual(notificationActor(reaction), { name: "Lia", picture: "https://x/p.png" });
  assert.deepEqual(notificationText(reaction), {
    handle: "@liocas",
    rest: " reacted to your activity",
    emoji: "🚀",
  });
});

test("a photo notice keeps the plan emoji in the text and badges the camera", () => {
  const photo = notice({
    message: "@liocas added photos to 🏋️ gym strength training 📸",
    relatedData: { userUsername: "liocas" },
  });
  assert.deepEqual(notificationActor(photo), { name: "liocas", picture: undefined });
  assert.deepEqual(notificationText(photo), {
    handle: "@liocas",
    rest: " added photos to 🏋️ gym strength training",
    emoji: "📸",
  });
});

test("only the closing emoji is taken, joined sequences stay whole", () => {
  assert.deepEqual(splitClosingEmoji("Nice one 🔥🔥"), { text: "Nice one 🔥", emoji: "🔥" });
  assert.deepEqual(splitClosingEmoji("Team 👨‍👩‍👧"), { text: "Team", emoji: "👨‍👩‍👧" });
  assert.deepEqual(splitClosingEmoji("Strong 💪🏽"), { text: "Strong", emoji: "💪🏽" });
  assert.deepEqual(splitClosingEmoji("No emoji here"), { text: "No emoji here" });
  assert.deepEqual(splitClosingEmoji("🔥"), { text: "🔥" });
});

test("markdown stars are dropped and a notice without a person has no actor", () => {
  const coach = notice({ type: "COACH", message: "**Two runs** left this week" });
  assert.equal(notificationText(coach).rest, "Two runs left this week");
  assert.equal(notificationActor(coach), null);
});

test("dismissed and engagement notices are hidden", () => {
  const list = [
    notice({ id: "a" }),
    notice({ id: "b", status: "CONCLUDED" }),
    notice({ id: "c", type: "ENGAGEMENT" }),
  ];
  assert.deepEqual(shownNotifications(list).map((n) => n.id), ["a"]);
});

test("what was unread on opening stays under New", () => {
  const list = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const { fresh, earlier } = splitSections(list, new Set(["b"]));
  assert.deepEqual(fresh.map((n) => n.id), ["b"]);
  assert.deepEqual(earlier.map((n) => n.id), ["a", "c"]);
});

test("time reads short: now, minutes, hours, days, weeks, then the date", () => {
  const now = new Date("2026-11-28T12:00:00Z");
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
  assert.equal(timeAgo(ago(20_000), now), "now");
  assert.equal(timeAgo(ago(5 * 60_000), now), "5m");
  assert.equal(timeAgo(ago(3 * 3600_000), now), "3h");
  assert.equal(timeAgo(ago(2 * 86400_000), now), "2d");
  assert.equal(timeAgo(ago(15 * 86400_000), now), "2w");
  assert.equal(timeAgo("2026-08-03T12:00:00Z", now), "3 Aug");
  assert.equal(timeAgo("2025-08-03T12:00:00Z", now), "3 Aug 2025");
  assert.equal(timeAgo(undefined, now), "");
});
