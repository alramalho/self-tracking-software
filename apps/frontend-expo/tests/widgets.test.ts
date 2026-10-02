import assert from "node:assert/strict";
import test from "node:test";
import type { ActivityEntry, Plan } from "../src/core/types";
import { widgetSnapshot } from "../src/native/widgets/model";
import type { WidgetData } from "../src/native/widgets/types";

const now = new Date("2026-09-30T12:00:00");
const plan: Plan = {
  id: "run", goal: "Exercise regularly", emoji: "🏃", outlineType: "TIMES_PER_WEEK",
  timesPerWeek: 3, activities: [{ id: "running", title: "Running", emoji: "🏃", measure: "km" }],
  sessions: [], createdAt: "2026-09-01", progress: {
    achievement: { streak: 4 }, habitAchievement: { isAchieved: false, maxValue: 4 },
    lifestyleAchievement: { isAchieved: false, maxValue: 9 },
  },
};
const entry = (id: string, datetime: string): ActivityEntry => ({
  id, activityId: "running", userId: "owner", datetime, quantity: 5, createdAt: datetime,
});
const data = (changes: Partial<WidgetData> = {}): WidgetData => ({
  plans: [plan], entries: [], metrics: [], metricEntries: [], ...changes,
});

test("weekly progress counts unique days and preserves the achievement stage", () => {
  const snapshot = widgetSnapshot(data({ entries: [
    entry("a", "2026-09-28T09:00:00"), entry("b", "2026-09-28T17:00:00"),
    entry("c", "2026-09-29T09:00:00"), { ...entry("deleted", "2026-09-30"), deletedAt: now },
    entry("old", "2026-09-20"),
  ] }), now);
  assert.equal(snapshot.weekStart, "2026-09-27");
  assert.equal(snapshot.plans[0].completed, 2);
  assert.equal(snapshot.plans[0].target, 3);
  assert.equal(snapshot.plans[0].streak, 4);
  assert.equal(snapshot.plans[0].stage, "Lifestyle");
});
test("homepage order is preserved; archived plans disappear and paused/ended states stay explicit", () => {
  const snapshot = widgetSnapshot(data({ plans: [
    { ...plan, id: "archived", archivedAt: now }, { ...plan, id: "deleted", deletedAt: now },
    { ...plan, id: "paused", isPaused: true, sortOrder: 0 },
    { ...plan, id: "ended", finishingDate: "2026-09-20", sortOrder: 1 }, plan,
  ] }), now);
  assert.deepEqual(snapshot.plans.map(plan => plan.id), ["paused", "ended", "run"]);
  assert.equal(snapshot.plans[0].paused, true);
  assert.equal(snapshot.plans[1].ended, true);
});
test("specific plans use this week's sessions and ignore old, paused and flexible sessions", () => {
  const specific = { ...plan, outlineType: "SPECIFIC" as const, sessions: [
    { id: "old", date: "2026-09-20", activityId: "running" },
    { id: "today", date: "2026-09-30", activityId: "running" },
    { id: "later", date: "2026-10-02", activityId: "running" },
  ] };
  const snapshot = widgetSnapshot(data({ plans: [specific,
    { ...specific, id: "paused", isPaused: true },
    { ...plan, id: "flexible", sessions: specific.sessions },
  ] }), now);
  assert.equal(snapshot.plans[0].target, 2);
  assert.deepEqual(snapshot.sessions.map(session => session.id), ["existing:today", "existing:later"]);
});
test("metric skips count as recorded days; invalid and future ratings are excluded", () => {
  const snapshot = widgetSnapshot(data({ metrics: [{ id: "mood", title: "Mood", emoji: "😊" }],
    metricEntries: [
      { id: "rated", metricId: "mood", rating: 4, createdAt: "2026-09-29T00:00:00Z" },
      { id: "skip", metricId: "mood", rating: 0, skipped: true, createdAt: "2026-09-30T00:00:00Z" },
      { id: "invalid", metricId: "mood", rating: 0, createdAt: "2026-09-28T00:00:00Z" },
      { id: "future", metricId: "mood", rating: 4, createdAt: "2026-10-01T00:00:00Z" },
    ],
  }), now);
  assert.deepEqual(snapshot.metrics[0].loggedDays, ["2026-09-29", "2026-09-30"]);
});
test("shared snapshots contain summaries without account identifiers, notes, ratings or auth", () => {
  const snapshot = widgetSnapshot(data({ plans: [{ ...plan, goalReason: "private", notes: "private" }],
    entries: [{ ...entry("a", "2026-09-28"), privateNotes: "private" }],
  }), now);
  const json = JSON.stringify(snapshot);
  for (const value of ["private", "owner", "userId", "rating", "token", "clerk"]) assert.ok(!json.includes(value));
  assert.equal(snapshot.version, 1);
});
