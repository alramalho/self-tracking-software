import { test } from "node:test";
import assert from "node:assert/strict";
import { alertFact, coachItems, masterOn, planAlert, planCoachingOn, supportFor } from "../src/features/coach/model";

const now = new Date("2026-10-21T12:00:00Z"); // Wednesday
const run = { id: "run", title: "Running", emoji: "🏃", measure: "km" };
const plan = (over: Record<string, unknown> = {}) =>
  ({
    id: "p1",
    goal: "Run a 10K",
    emoji: "🏃",
    outlineType: "TIMES_PER_WEEK",
    timesPerWeek: 3,
    activities: [run],
    sessions: [],
    createdAt: "2026-09-01T00:00:00Z",
    ...over,
  }) as never;
const support = (role: "tracking" | "consistency" | "training") =>
  ({
    planId: "p1",
    coaching: { role, followUps: false, dataAccess: { workouts: false, sleep: false } },
    preferences: { coaching: role !== "tracking", weeklyReview: false },
  }) as never;
const state = (over: Record<string, unknown> = {}) =>
  ({ version: 1, enabled: true, pausedAt: null, supports: { p1: support("consistency") }, sessions: {}, checks: {}, monitoring: { requests: [], reviewed: {}, pausedPlanIds: [], outreachPaused: false }, ...over }) as never;

test("the master switch follows the coach's pause, not each plan", () => {
  assert.equal(masterOn(state()), true);
  assert.equal(masterOn(state({ monitoring: { requests: [], reviewed: {}, pausedPlanIds: [], outreachPaused: true } })), false);
  assert.equal(masterOn(state({ pausedAt: "2026-10-01" })), false);
  assert.equal(masterOn(undefined), false);
});

test("a plan's switch keeps its own choice and maps to a coaching role", () => {
  assert.equal(planCoachingOn(state(), "p1"), true);
  assert.equal(planCoachingOn(state({ supports: { p1: support("tracking") } }), "p1"), false);
  const off = supportFor(state(), plan(), false);
  assert.equal(off.support.coaching?.role, "tracking");
  const on = supportFor(state({ supports: { p1: support("tracking") } }), plan({ orientation: "OUTCOME" }), true);
  assert.equal(on.support.coaching?.role, "training");
  assert.equal(on.support.coaching?.followUps, true);
  assert.equal(on.support.preferences.weeklyReview, true);
});

test("turning a coach-paused plan back on also resumes it", () => {
  const paused = state({ supports: { p1: support("tracking") }, monitoring: { requests: [], reviewed: {}, pausedPlanIds: ["p1"] } });
  assert.equal(supportFor(paused, plan(), true).resume, true);
  assert.equal(supportFor(paused, plan(), false).resume, false);
});

test("a coached plan with no recent logs has gone quiet", () => {
  const entries = [{ id: "e", activityId: "run", datetime: "2026-10-13T08:00:00Z", userId: "u", quantity: 3, createdAt: "2026-10-13T08:00:00Z" }] as never;
  const alert = planAlert({ plan: plan(), entries, state: state(), now })!;
  assert.equal(alert.status, "quiet");
  assert.equal(alertFact(alert), "8 days without a log");
});

test("tracking-only plans never go quiet, but a missed week still shows", () => {
  const tracking = state({ supports: { p1: support("tracking") } });
  assert.equal(planAlert({ plan: plan({ outlineType: "SPECIFIC" }), entries: [], state: tracking, now }), null);
  const missed = plan({ outlineType: "SPECIFIC", progress: { achievement: { streak: 5, missedLastWeek: { streakBefore: 6, streakAfter: 5, inARow: 1 } } } });
  const alert = planAlert({ plan: missed, entries: [], state: tracking, now })!;
  assert.equal(alert.status, "missed");
  assert.equal(alertFact(alert), "Streak 6 → 5");
});

test("the Recent list holds alerts, open questions, checks and today's check-in", () => {
  const s = state({
    monitoring: {
      requests: [
        { id: "r1", planIds: ["p1"], kind: "conversation", requiresReply: true, createdAt: "2026-10-20T10:00:00Z", chatId: "c", messageId: "m" },
        { id: "r2", planIds: ["p1"], kind: "review", requiresReply: true, createdAt: "2026-10-19T10:00:00Z", resolvedAt: "2026-10-19T11:00:00Z" },
      ],
      reviewed: {},
      pausedPlanIds: [],
    },
  });
  const items = coachItems({
    plans: [plan()],
    entries: [],
    state: s,
    attention: [],
    metrics: [{ id: "energy", title: "Energy", emoji: "⚡" }],
    checkedInToday: false,
    answeredMisses: [],
    now,
  });
  const kinds = items.map((i) => i.kind).sort();
  assert.deepEqual(kinds, ["alert", "checkin", "request"]);
  assert.equal(items.find((i) => i.kind === "request")?.title, "A question for you");
});

test("an answered missed week leaves the list", () => {
  const missed = plan({ outlineType: "SPECIFIC", progress: { achievement: { streak: 5, missedLastWeek: { streakBefore: 6, streakAfter: 5, inARow: 1 } } } });
  // Logged yesterday, so the plan isn't quiet: only last week's miss is waiting.
  const entries = [{ id: "e", activityId: "run", datetime: "2026-10-20T08:00:00Z", userId: "u", quantity: 3, createdAt: "2026-10-20T08:00:00Z" }] as never;
  const base = { plans: [missed], entries, state: state(), attention: [], metrics: [], checkedInToday: true, now };
  assert.equal(coachItems({ ...base, answeredMisses: [] }).length, 1);
  assert.equal(coachItems({ ...base, answeredMisses: ["p1"] }).length, 0);
});

test("answering the coach's nudge quiets a gone-quiet plan for a day", () => {
  const entries = [{ id: "e", activityId: "run", datetime: "2026-10-13T08:00:00Z", userId: "u", quantity: 3, createdAt: "2026-10-13T08:00:00Z" }] as never;
  const answered = state({
    monitoring: { requests: [{ id: "n", planIds: ["p1"], kind: "nudge", requiresReply: true, createdAt: "2026-10-20T08:00:00Z", resolvedAt: "2026-10-21T09:00:00Z" }], reviewed: {}, pausedPlanIds: [] },
  });
  // Twice a week: quiet after 8 days, but this week still has room, so it is not at risk.
  const twice = plan({ timesPerWeek: 2 });
  assert.equal(planAlert({ plan: twice, entries, state: answered, now }), null);
  const later = new Date("2026-10-22T10:00:00Z");
  assert.equal(planAlert({ plan: twice, entries, state: answered, now: later })?.status, "quiet");
});

test("with coaching off, or a plan just tracked, the coach has nothing waiting", () => {
  const missed = plan({ outlineType: "SPECIFIC", progress: { achievement: { streak: 5, missedLastWeek: { streakBefore: 6, streakAfter: 5, inARow: 1 } } } });
  const base = { plans: [missed], entries: [], attention: [], metrics: [{ id: "energy", title: "Energy", emoji: "⚡" }], checkedInToday: false, answeredMisses: [], now };
  const off = state({ monitoring: { requests: [], reviewed: {}, pausedPlanIds: [], outreachPaused: true } });
  assert.deepEqual(coachItems({ ...base, state: off }), []);
  const tracked = coachItems({ ...base, state: state({ supports: { p1: support("tracking") } }) });
  assert.deepEqual(tracked.map((i) => i.kind), ["checkin"]);
});
