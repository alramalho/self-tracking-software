import test from "node:test";
import assert from "node:assert/strict";
import { mergeTimeline } from "../src/features/timeline/model";
import {
  feedPhotos,
  containsEntry,
  timelineRows,
} from "../src/features/timeline/layout";
import type { ActivityEntry, TimelinePage } from "../src/core/types";

test("joint cards retain embedded participants and unique photos while excluding deleted and expired photos", () => {
  const now = new Date().toISOString();
  const first: ActivityEntry = {
    id: "a",
    userId: "one",
    activityId: "run",
    datetime: now,
    createdAt: now,
    quantity: 5,
    imageUrls: ["one.jpg", "duplicate.jpg"],
  };
  const second: ActivityEntry = {
    ...first,
    id: "b",
    userId: "two",
    activityId: "read",
    quantity: 20,
    imageUrls: ["two.jpg", "duplicate.jpg"],
  };
  const expired: ActivityEntry = {
    ...first,
    id: "c",
    imageUrls: ["expired.jpg"],
    imageExpiresAt: "2000-01-01",
  };
  const deleted: ActivityEntry = {
    ...first,
    id: "d",
    deletedAt: now,
    imageUrls: ["deleted.jpg"],
  };
  first.sharedActivityEntry = {
    sharedActivity: {
      entries: [first, second, expired, deleted].map((row) => ({
        activityEntryId: row.id,
        activityEntry: { ...row },
        user: { id: row.userId, username: row.userId },
      })),
    },
  };
  const page: TimelinePage = {
    recommendedActivityEntries: [first],
    recommendedActivities: [],
    recommendedUsers: [],
    achievementPosts: [],
  };
  const [card] = mergeTimeline([
    page,
    { ...page, recommendedActivityEntries: [second, first] },
  ]);
  assert.deepEqual(
    [card, ...(card.sharedEntries ?? [])].map((row) => row.entry!.id).sort(),
    ["a", "b", "c"],
  );
  assert.deepEqual(
    new Set(feedPhotos(card)),
    new Set(["one.jpg", "two.jpg", "duplicate.jpg"]),
  );
  assert.ok(containsEntry(card, "b"));
  assert.equal(containsEntry(card, "d"), false);
  assert.equal(
    timelineRows([{ id: card.id, item: card }], new Set())[0].compact,
    false,
  );
});

test("multiple activities by the same participant remain separate summary rows", () => {
  const now = new Date().toISOString();
  const first: ActivityEntry = {
    id: "a",
    userId: "one",
    activityId: "run",
    datetime: now,
    createdAt: now,
    quantity: 5,
  };
  const second: ActivityEntry = {
    ...first,
    id: "b",
    activityId: "read",
    quantity: 20,
  };
  first.sharedActivityEntry = {
    sharedActivity: {
      entries: [first, second].map((row) => ({
        activityEntryId: row.id,
        user: { id: "one" },
      })),
    },
  };
  const items = mergeTimeline([
    {
      recommendedActivityEntries: [first, second],
      recommendedActivities: [],
      recommendedUsers: [],
      achievementPosts: [],
    },
  ]);
  assert.equal(items.length, 1);
  assert.deepEqual(
    [items[0], ...items[0].sharedEntries!]
      .map((row) => row.entry!.quantity)
      .sort((a, b) => a - b),
    [5, 20],
  );
  assert.equal(
    timelineRows([{ id: items[0].id, item: items[0] }], new Set(), "a")[0]
      .compact,
    false,
  );
});
