import test from "node:test";
import assert from "node:assert/strict";
import {
  activityTotals,
  countries,
  journeyData,
  moodStats,
  peakStreak,
  storiesFor,
  yearEntries,
  yearMetrics,
} from "../src/features/wrapped/model";
import type { Activity, ActivityEntry, Plan } from "../src/core/types";
const activity: Activity = {
  id: "run",
  title: "Running",
  emoji: "🏃",
  measure: "km",
};
const entry = (id: string, date: string, quantity = 5): ActivityEntry => ({
  id,
  activityId: "run",
  userId: "u",
  datetime: date,
  createdAt: date,
  quantity,
  timezone: "Europe/Lisbon",
});
const plan: Plan = {
  id: "p",
  goal: "Run",
  emoji: "🏃",
  outlineType: "TIMES_PER_WEEK",
  timesPerWeek: 3,
  activities: [activity],
  sessions: [],
  createdAt: "2025-01-01",
  progress: {
    habitAchievement: { isAchieved: true },
    achievement: { streak: 2 },
    weeks: [
      { startDate: "2025-01-12", isCompleted: false },
      { startDate: "2025-01-05", isCompleted: true },
    ],
  },
};
test("wrapped separates retrospective totals, duplicate-day logs and year-only entries and historical plan peaks", () => {
  const logs = [
    entry("a", "2025-01-01T10:00:00Z"),
    entry("b", "2025-01-01T12:00:00Z", 7),
    entry("c", "2026-01-01T12:00:00Z"),
  ];
  const year = yearEntries(logs, 2025);
  assert.equal(year.length, 2);
  assert.deepEqual(
    activityTotals(year, [activity]).map((t) => [t.days, t.quantity, t.count]),
    [[1, 12, 2]],
  );
  assert.deepEqual(countries(year), [
    { code: "PT", count: 2, name: "Portugal" },
  ]);
  assert.equal(peakStreak(plan, [{id:"p",peakStreak:1,habitEarned:false,lifestyleEarned:false}]), 1);
});
test("mood excludes skipped values and requires three observations for period insights", () => {
  const metrics = Array.from({ length: 8 }, (_, i) => ({
    id: String(i),
    metricId: "m",
    rating: i < 4 ? 5 : 1,
    createdAt: `2025-0${i < 4 ? 1 : 2}-0${(i % 4) + 1}`,
  }));
  const stats = moodStats(
    yearMetrics(
      [...metrics, { ...metrics[0], id: "skipped", skipped: true }],
      2025,
    ),
  );
  assert.equal(stats.average, 3);
  assert.equal(stats.bestMonth.label, "Jan");
  assert.equal(stats.worstMonth?.label, "Feb");
});
test("empty stories omit blank optional slides and journey never divides by zero", () => {
  assert.deepEqual(
    storiesFor({
      year: 2025,
      entries: [],
      metrics: [],
      plans: [],
      activities: [],
      user: { id: "u" },
      friends: [],
      self: {username:"u",totalPoints:0,bestStreak:0},
      annualPlans: [],
    }),
    ["hero", "world", "journey", "mood"],
  );
  assert.deepEqual(journeyData([], [], []), {
    days: [],
    lines: [],
    photos: [],
  });
  const result = journeyData(
    [entry("a", "2025-01-01"), entry("b", "2025-02-01")],
    [],
    [activity],
  );
  assert.equal(result.days.length, 32);
  assert.equal(result.lines[0].points.at(-1)?.value, 1);
});

test("annual plan peaks never fall back to current profile values", () => {
  assert.equal(peakStreak(plan, []), 0);
  assert.equal(peakStreak(plan, [{id:"p",peakStreak:12,habitEarned:true,lifestyleEarned:false}]), 12);
  assert.equal(yearEntries([entry("boundary", "2026-01-01T00:00:00Z")], 2025).length, 0);
});
