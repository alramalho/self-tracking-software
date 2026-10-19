import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPlanWeekProjection } from "@tsw/prisma/plan-week";
import { dayKind, planDays } from "../src/features/plans/weeks/model";

const now = new Date("2026-10-21T12:00:00Z"); // a Wednesday
const run = { id: "run", title: "Running", emoji: "🏃", measure: "km" };

test("the plan page shows this week and next, Sunday first, with today marked", () => {
  const projection = buildPlanWeekProjection({ plans: [], entries: [], now, weekCount: 2 });
  const weeks = planDays(projection);
  assert.equal(weeks.length, 2);
  assert.equal(weeks[0][0].key, "2026-10-18");
  assert.equal(weeks[1][6].key, "2026-10-31");
  assert.equal(weeks[0].find((d) => d.isToday)?.key, "2026-10-21");
  assert.equal(weeks[0][1].isPast, true);
});

test("scheduled sessions, logged days and rest days read as such", () => {
  const plan = {
    id: "p",
    goal: "Run a 10K",
    outlineType: "SPECIFIC",
    activities: [run],
    sessions: [
      { id: "s1", date: "2026-10-20", activityId: "run", quantity: 3 },
      { id: "s2", date: "2026-10-23", activityId: "run", quantity: 5 },
    ],
  };
  const entries = [{ activityId: "run", datetime: "2026-10-20T07:00:00Z" }];
  const projection = buildPlanWeekProjection({ plans: [plan], entries, now, weekCount: 2 });
  const days = planDays(projection, entries).flat();
  const on = (key: string) => days.find((d) => d.key === key)!;
  assert.equal(dayKind(on("2026-10-20")), "scheduled");
  assert.equal(on("2026-10-20").logged, true);
  assert.equal(on("2026-10-23").logged, false);
  assert.equal(dayKind(on("2026-10-23")), "scheduled");
  assert.equal(dayKind(on("2026-10-22")), "rest");
});

test("a times-per-week plan offers open days instead of fixed sessions", () => {
  const plan = { id: "p", goal: "Gym 3x", outlineType: "TIMES_PER_WEEK", timesPerWeek: 3, activities: [run], sessions: [] };
  const projection = buildPlanWeekProjection({ plans: [plan], entries: [], now, weekCount: 2 });
  const kinds = planDays(projection)[0].map(dayKind);
  assert.ok(kinds.includes("flexible"));
  assert.ok(!kinds.includes("scheduled"));
});
