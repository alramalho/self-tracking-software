import test from "node:test";
import assert from "node:assert/strict";
import { activityColor, buildHeatmap } from "../src/features/plans/grid-model";
import { buildPlanWeekProjection } from "@tsw/prisma/plan-week";
import { mergeTimeline } from "../src/features/timeline/model";
import {
  dailyRatings,
  metricDayKey,
  metricSummary,
} from "../src/features/metrics/model";
import type {
  Activity,
  ActivityEntry,
  Plan,
  TimelinePage,
} from "../src/core/types";
const activities: Activity[] = [
  { id: "a", title: "Run", emoji: "🏃", measure: "km" },
  { id: "b", title: "Read", emoji: "📚", measure: "pages" },
];
const entry = (
  id: string,
  activityId: string,
  datetime: string,
  quantity: number,
): ActivityEntry => ({
  id,
  activityId,
  datetime,
  quantity,
  userId: "u",
  createdAt: datetime,
});
const now = new Date("2026-03-29T12:00:00");
test("calendar stays on local dates across the daylight saving transition", () => {
  const entries = [
    entry("a", "a", "2026-03-29T00:30:00", 1),
    entry("b", "b", "2026-03-29T23:30:00", 10),
  ];
  const grid = buildHeatmap({ activities, entries, now });
  const days = grid.weeks.flatMap((w) => w.days);
  assert.equal(days.find((d) => d.key === "2026-03-29")?.entries.length, 2);
  assert.equal(new Set(days.map((d) => d.key)).size, days.length);
  assert.ok(days.find((d) => d.key === "2026-03-30"));
});
test("per-activity intensity, multiple entries and deleted entries", () => {
  const rows = [
    entry("low", "a", "2026-03-28T12:00:00", 1),
    entry("high", "a", "2026-03-29T12:00:00", 6),
    entry("book", "b", "2026-03-29T12:00:00", 90),
    { ...entry("deleted", "b", "2026-03-29T12:00:00", 500), deletedAt: now },
  ];
  const grid = buildHeatmap({ activities, entries: rows, now });
  const today = grid.weeks.flatMap((w) => w.days).find((d) => d.today)!;
  assert.equal(today.segments.length, 2);
  assert.equal(today.segments[0].intensity, 4);
  assert.equal(today.segments[1].intensity, 0);
  assert.equal(rows[0].id, "low");
});
test("pause boundaries and server-computed weekly completion", () => {
  const plan = {
    pauseHistory: [
      { pausedAt: "2026-03-28T20:00:00", resumedAt: "2026-03-29T10:00:00" },
    ],
    progress: { weeks: [{ startDate: "2026-03-29", isCompleted: true }] },
  } as Plan;
  const grid = buildHeatmap({ activities, entries: [], plan, now });
  assert.equal(grid.weeks.find((w) => w.key === "2026-03-29")?.completed, true);
  assert.equal(
    grid.weeks.flatMap((w) => w.days).find((d) => d.key === "2026-03-29")
      ?.paused,
    true,
  );
  assert.equal(
    grid.weeks.flatMap((w) => w.days).find((d) => d.key === "2026-03-30")
      ?.paused,
    false,
  );
});
test("free history cap and minimum five weeks for empty plans", () => {
  const rows = [entry("old", "a", "2020-01-01", 2)];
  assert.equal(
    buildHeatmap({ activities, entries: rows, now }).historyLimited,
    true,
  );
  assert.equal(
    buildHeatmap({ activities, entries: rows, now, premium: true })
      .historyLimited,
    false,
  );
  assert.ok(buildHeatmap({ activities, entries: [], now }).weeks.length >= 5);
});
test("shared projection reduces flexible goal after a fresh completion", () => {
  const plan = {
    id: "p",
    goal: "Run",
    outlineType: "TIMES_PER_WEEK",
    timesPerWeek: 3,
    activities,
  };
  const before = buildPlanWeekProjection({
    plans: [plan],
    entries: [],
    now,
    weekCount: 1,
  });
  const after = buildPlanWeekProjection({
    plans: [plan],
    entries: [entry("new", "a", now.toISOString(), 5)],
    now,
    weekCount: 1,
  });
  assert.equal(after.flexibleCells.length, before.flexibleCells.length - 1);
});
test("timeline pagination deduplicates overlapping results", () => {
  const row = entry("a", "a", now.toISOString(), 1);
  const page: TimelinePage = {
    recommendedActivityEntries: [row],
    recommendedActivities: activities,
    recommendedUsers: [],
    achievementPosts: [],
  };
  assert.equal(mergeTimeline([page, page]).length, 1);
});
test("skipped metric ratings never become zero-valued observations", () => {
  const rows = [
    { id: "a", metricId: "m", rating: 5, createdAt: now },
    { id: "b", metricId: "m", rating: 0, createdAt: now, skipped: true },
    { id: "c", metricId: "m", rating: 3, createdAt: now },
  ];
  assert.equal(metricSummary(rows, now).currentAverage, 4);
  assert.equal([...dailyRatings(rows).values()][0], 4);
  assert.equal(metricSummary([], now).trend, null);
});

test("heatmap uses the existing dark palette and preserves custom intensity", () => {
  assert.equal(activityColor(0, 0, undefined, true), "#065F46");
  assert.equal(activityColor(1, 4, undefined, true), "#38BDF8");
  assert.equal(activityColor(0, 4, "#123456", true), "#123456ff");
  assert.equal(activityColor(0, 0, "#123456", false), "#12345666");
});
test("metric calendar dates remain stable in every device timezone", () => {
  const date = "2026-03-29T00:00:00.000Z";
  assert.equal(metricDayKey(date), "2026-03-29");
  assert.equal(
    dailyRatings([{ id: "m", metricId: "m", createdAt: date, rating: 5 }]).get(
      "2026-03-29",
    ),
    5,
  );
});

test("shared activity entries spanning pagination render once with both participants", () => {
  const first = entry("shared-a", "a", now.toISOString(), 1);
  const second = entry("shared-b", "b", now.toISOString(), 2);
  first.sharedActivityEntry = {
    sharedActivity: {
      entries: [
        { activityEntryId: first.id, user: { id: "u" } },
        { activityEntryId: second.id, user: { id: "v" } },
      ],
    },
  };
  second.sharedActivityEntry = first.sharedActivityEntry;
  const base = {
    recommendedActivities: activities,
    recommendedUsers: [],
    achievementPosts: [],
  };
  const items = mergeTimeline([
    { ...base, recommendedActivityEntries: [first] },
    { ...base, recommendedActivityEntries: [first, second] },
  ]);
  assert.equal(items.length, 1);
  assert.equal(items[0].sharedEntries?.length, 1);
  assert.equal(
    new Set([items[0].entry?.id, items[0].sharedEntries?.[0].entry?.id]).size,
    2,
  );
});
