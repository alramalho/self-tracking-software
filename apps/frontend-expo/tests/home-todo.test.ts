import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPlanWeekProjection } from "@tsw/prisma/plan-week";
import { homeDays, pickCoachNote } from "@tsw/prisma/home-todo";
import type { CoachNoteCandidate } from "@tsw/prisma/home-todo";

const now = new Date("2026-10-21T12:00:00Z"); // a Wednesday
const run = { id: "run", title: "Running", emoji: "🏃", measure: "km" };
const read = { id: "read", title: "Reading", emoji: "📚", measure: "pages" };
const runPlan = {
  id: "runs",
  goal: "Run a 10K",
  emoji: "🏃",
  outlineType: "SPECIFIC",
  activities: [run],
  sessions: [
    { id: "s1", date: "2026-10-20", activityId: "run", quantity: 3 },
    { id: "s2", date: "2026-10-21", activityId: "run", quantity: 5 },
    { id: "s3", date: "2026-10-28", activityId: "run", quantity: 6 },
  ],
};
const readPlan = { id: "reads", goal: "Read more", emoji: "📖", outlineType: "TIMES_PER_WEEK", timesPerWeek: 3, activities: [read], sessions: [] };

function days(entries: { activityId: string; datetime: string }[] = []) {
  const plans = [runPlan, readPlan];
  const projection = buildPlanWeekProjection({ plans, entries, now, weekCount: 2 });
  return homeDays({ projection, plans, entries }).flat();
}
const on = (all: ReturnType<typeof days>, key: string) => all.find((day) => day.key === key)!;

test("the homepage shows this week and next across every plan, Sunday first", () => {
  const all = days();
  assert.equal(all.length, 14);
  assert.equal(all[0].key, "2026-10-18");
  assert.equal(all.find((day) => day.isToday)?.key, "2026-10-21");
  assert.deepEqual(
    on(all, "2026-10-28").items.filter((item) => item.planId === "runs").map((item) => [item.kind, item.quantity]),
    [["scheduled", 6]],
  );
});

test("a logged session reads as done, and what is left comes first", () => {
  const all = days([
    { activityId: "run", datetime: "2026-10-20T07:00:00Z" },
    { activityId: "read", datetime: "2026-10-21T08:00:00Z" },
  ]);
  assert.deepEqual(on(all, "2026-10-20").items.map((item) => item.kind), ["done"]);
  const today = on(all, "2026-10-21").items;
  assert.equal(today[0].kind, "scheduled");
  assert.equal(today[0].title, "Running");
  assert.ok(today.some((item) => item.planId === "reads" && item.kind === "done"));
});

test("a weekly-target plan offers open slots with how many are left", () => {
  const slot = days()
    .flatMap((day) => day.items)
    .find((item) => item.planId === "reads" && item.kind === "flexible");
  assert.equal(slot?.planGoal, "Read more");
  assert.equal(slot?.remaining, 3);
});

const item = (kind: CoachNoteCandidate["kind"], hoursAgo: number, alert?: CoachNoteCandidate["alert"]) => ({
  kind,
  at: new Date(now.getTime() - hoursAgo * 3_600_000).toISOString(),
  alert,
});

test("the coach note picks a fresh question from the coach first", () => {
  const question = item("request", 2);
  assert.equal(pickCoachNote([item("alert", 0, { status: "at_risk" }), question, item("checkin", 0)], now), question);
});

test("the coach note shows nothing when only routine or stale items wait", () => {
  assert.equal(pickCoachNote([item("checkin", 0), item("request", 49), item("attention", 72)], now), null);
  assert.equal(pickCoachNote([item("alert", 0, { status: "quiet" })], now), null);
  assert.equal(pickCoachNote([], now), null);
});

test("a plan at risk this week outranks an older miss or a fresh warning", () => {
  const atRisk = item("alert", 0, { status: "at_risk" });
  assert.equal(pickCoachNote([item("alert", 0, { status: "missed" }), item("attention", 1), atRisk], now), atRisk);
});

test("a coach practice session joins its plan's day with a time, or adds the day", () => {
  const plans = [runPlan, readPlan];
  const projection = buildPlanWeekProjection({ plans, entries: [], now, weekCount: 2 });
  const practice = [
    { id: "existing:s2", planId: "runs", activityId: "run", date: "2026-10-21", time: "18:00", outcome: "UNCONFIRMED" },
    { id: "rec-1", planId: "reads", activityId: "read", date: "2026-10-23", time: "07:30", outcome: "UNCONFIRMED" },
    { id: "rec-2", planId: "reads", activityId: "read", date: "2026-10-20", time: null, outcome: "DONE" },
  ];
  const all = homeDays({ projection, plans, entries: [], practice }).flat();
  const runToday = on(all, "2026-10-21").items.filter((item) => item.planId === "runs");
  assert.deepEqual(runToday.map((item) => [item.kind, item.sessionId, item.time]), [["scheduled", "existing:s2", "18:00"]]);
  const readFriday = on(all, "2026-10-23").items.find((item) => item.planId === "reads");
  assert.deepEqual([readFriday?.kind, readFriday?.time], ["scheduled", "07:30"]);
  assert.equal(on(all, "2026-10-20").items.find((item) => item.planId === "reads")?.kind, "done");
});
