import test from "node:test";
import assert from "node:assert/strict";
import { profileStats, friendsOf } from "../src/features/profile/model";
import { reorderVisiblePlans } from "../src/features/plans/reorder";
import { getMetricEventImpacts } from "../src/features/metrics/analysis";
import type { Plan, User, MetricEntry } from "../src/core/types";
test("server account totals take precedence over a limited profile history", () => {
  const user: User = {
    id: "sam",
    activityEntries: [],
    accountStats: {
      totalActivitiesLogged: 100,
      totalPoints: 150,
      habitCount: 2,
    },
  };
  const stats = profileStats(user);
  assert.equal(stats.activities, 100);
  assert.equal(stats.points, 150);
  assert.equal(stats.level.name, "Silver");
  assert.equal(stats.next?.name, "Gold");
  assert.equal(stats.habitBonus, 50);
});
test("friends are ordered by non-deleted activity-entry count", () => {
  const user = {
    id: "me",
    connectionsFrom: [
      {
        id: "connection-quiet",
        fromId: "me",
        toId: "quiet",
        status: "ACCEPTED",
        from: { id: "me" },
        to: {
          id: "quiet",
          name: "Quiet",
          _count: { activityEntries: 2 },
        },
      },
      {
        id: "connection-active",
        fromId: "me",
        toId: "active",
        status: "ACCEPTED",
        from: { id: "me" },
        to: {
          id: "active",
          name: "Active",
          _count: { activityEntries: 12 },
        },
      },
    ],
  } as User;

  assert.deepEqual(
    friendsOf(user).map((friend) => friend.name),
    ["Active", "Quiet"],
  );
});
test("reordering visible plans preserves archived slots and leaves input unchanged", () => {
  const all = ["a", "hidden", "b", "c"].map(
    (id, sortOrder) => ({ id, sortOrder }) as Plan,
  );
  const result = reorderVisiblePlans(all, [all[0], all[2], all[3]], "c", 0);
  assert.deepEqual(
    result.map((p) => p.id),
    ["c", "hidden", "a", "b"],
  );
  assert.deepEqual(
    result.map((p) => p.sortOrder),
    [0, 1, 2, 3],
  );
  assert.deepEqual(
    all.map((p) => p.id),
    ["a", "hidden", "b", "c"],
  );
});
test("event impacts need a meaningful baseline and exclude skipped check-ins", () => {
  const entries: MetricEntry[] = Array.from({ length: 7 }, (_, index) => ({
    id: String(index),
    metricId: "m",
    createdAt: `2026-09-0${index + 1}T00:00:00Z`,
    rating: index >= 5 ? 5 : 2,
  }));
  const event = {
    id: "holiday",
    title: "Holiday",
    occurredAt: new Date(2026, 8, 6),
    endedAt: new Date(2026, 8, 7),
  };
  const result = getMetricEventImpacts("m", entries, [event]);
  assert.equal(result[0].delta, 3);
  assert.equal(result[0].duringEntryCount, 2);
  assert.equal(result[0].baselineEntryCount, 5);
  assert.deepEqual(
    getMetricEventImpacts(
      "m",
      entries.map((e, i) => ({ ...e, skipped: i === 6 })),
      [event],
    ),
    [],
  );
});
