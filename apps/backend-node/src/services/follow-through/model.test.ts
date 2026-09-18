import { describe, it, expect } from "vitest";
import {
  initialState,
  instant,
  materialize,
  outreach,
  updateSilence,
} from "./model";
import type { PlanSupport } from "@tsw/prisma/follow-through";
import type { SupportPlanRecord } from "./types";

const plan: SupportPlanRecord = {
  id: "p",
  goal: "Guitar",
  emoji: "🎸",
  timesPerWeek: 3,
  finishingDate: null,
  isPaused: false,
  archivedAt: null,
  deletedAt: null,
  activities: [
    {
      id: "a",
      title: "guitar",
      emoji: "🎸",
      measure: "minutes",
      deletedAt: null,
    },
  ],
  sessions: [],
};
const config = (): PlanSupport => ({
  planId: "p",
  mode: "TIMED",
  weekdays: [3],
  time: "18:00",
  timezone: "Europe/Lisbon",
  durationMinutes: 60,
  format: "RESOURCE",
  resourceUrl: "https://www.pickupmusic.com",
  resourceName: "Pickup Music",
  nextStep: "My saved exercise",
  effectiveDate: "2026-09-15",
  preferences: {
    coaching: true,
    reminder: true,
    reminderMinutes: 30,
    dayReminderTime: "09:00",
    checkIn: true,
    checkInTime: "09:00",
    weeklyReview: false,
    reviewDay: 0,
    reviewTime: "18:00",
  },
});
function setup() {
  const state = initialState();
  state.enabled = true;
  state.supports.p = config();
  materialize(state, [plan], new Date("2026-09-16T16:30:00Z"));
  return state;
}
describe("scheduled support", () => {
  it("respects local summer time and rejects nonexistent DST slots", () => {
    expect(instant("2026-09-16", "18:00", "Europe/Lisbon")?.toISOString()).toBe(
      "2026-09-16T17:00:00.000Z",
    );
    expect(instant("2026-03-29", "01:30", "Europe/Lisbon")).toBeNull();
  });
  it("generates reminders only at agreed times, without claiming activity completion", () => {
    const state = setup();
    expect(
      outreach(state, [plan], new Date("2026-09-16T16:30:00Z"), true)[0]
        .checkId,
    ).toBeNull();
    expect(
      outreach(state, [plan], new Date("2026-09-16T18:15:00Z"), true)[0]
        .checkId,
    ).toContain("check:");
    expect(Object.values(state.sessions)[0].outcome).toBe("UNCONFIRMED");
    expect(
      outreach(state, [plan], new Date("2026-09-16T19:00:00Z"), true),
    ).toHaveLength(0);
  });
  it("never sends coach checks to free users or when consent is off", () => {
    const state = setup();
    expect(
      outreach(state, [plan], new Date("2026-09-16T18:15:00Z"), false),
    ).toHaveLength(0);
    state.supports.p.preferences.checkIn = false;
    expect(
      outreach(state, [plan], new Date("2026-09-16T18:15:00Z"), true),
    ).toHaveLength(0);
  });
  it("preserves completed sessions, skips and running timers across reconciliation", () => {
    const state = setup();
    const session = state.sessions["repeat:p:2026-09-16"];
    session.outcome = "SKIPPED";
    materialize(state, [plan], new Date("2026-09-16T16:30:00Z"));
    expect(session.outcome).toBe("SKIPPED");
    expect(
      outreach(state, [plan], new Date("2026-09-16T16:30:00Z"), true),
    ).toHaveLength(0);
    session.outcome = "UNCONFIRMED";
    session.timerRunning = true;
    expect(
      outreach(state, [plan], new Date("2026-09-16T18:15:00Z"), true),
    ).toHaveLength(0);
  });
  it("does not create extra prescribed workouts or sessions for a flexible target", () => {
    const state = setup();
    state.sessions = {};
    const prescribed = {
      ...plan,
      sessions: [
        {
          id: "prescribed",
          activityId: "a",
          date: new Date("2026-09-16Z"),
          quantity: 20,
          descriptiveGuide: "Teacher's exercise",
        },
      ],
    };
    materialize(state, [prescribed], new Date("2026-09-16T12:00:00Z"));
    expect(
      Object.values(state.sessions).filter((s) => s.date === "2026-09-16"),
    ).toHaveLength(1);
    state.sessions = {};
    state.supports.p.mode = "WEEKLY";
    materialize(state, [plan], new Date("2026-09-16T12:00:00Z"));
    expect(Object.values(state.sessions)).toHaveLength(0);
  });
  it("pauses after two unanswered delivered checks, leaving explicit reminders enabled", () => {
    const state = setup();
    for (const id of ["one", "two"])
      state.checks[id] = {
        id,
        planId: "p",
        sessionId: null,
        kind: "WEEKLY",
        dueAt: "2026-09-10T12:00:00Z",
        sentAt: "2026-09-10T12:00:00Z",
        answeredAt: null,
        dismissedAt: null,
        message: "Check",
      };
    updateSilence(state, new Date("2026-09-16T16:30:00Z"));
    expect(state.pausedAt).toBeTruthy();
    expect(
      outreach(state, [plan], new Date("2026-09-16T18:15:00Z"), true),
    ).toHaveLength(0);
    expect(
      outreach(state, [plan], new Date("2026-09-16T16:30:00Z"), true),
    ).toHaveLength(1);
  });
  it("does not treat undelivered notifications as ignored", () => {
    const state = setup();
    outreach(state, [plan], new Date("2026-09-16T18:15:00Z"), true);
    updateSilence(state, new Date("2026-09-30T18:15:00Z"));
    expect(state.pausedAt).toBeNull();
  });
});

describe("real logs and bounded coach reach-outs", () => {
  it("resolves one matching log but leaves ambiguous and running sessions unconfirmed", async () => {
    const { reconcileEntries } = await import("./model");
    const state = setup(),
      now = new Date("2026-09-16T18:15:00Z");
    outreach(state, [plan], now, true);
    const entry = {
      id: "log",
      activityId: "a",
      datetime: now,
      deletedAt: null,
    };
    const session = state.sessions["repeat:p:2026-09-16"];
    state.sessions.extra = { ...session, id: "extra" };
    reconcileEntries(state, [entry], now);
    expect(session.outcome).toBe("UNCONFIRMED");
    delete state.sessions.extra;
    session.timerRunning = true;
    reconcileEntries(state, [entry], now);
    expect(session.outcome).toBe("UNCONFIRMED");
    session.timerRunning = false;
    reconcileEntries(state, [entry], now);
    expect(session.entryId).toBe("log");
    expect(Object.values(state.checks)[0].answeredAt).toBeTruthy();
    expect(outreach(state, [plan], now, true)).toHaveLength(0);
  });
  it("uses a durable claim to cap simultaneous workers without counting delivery failures as ignored", async () => {
    const { hasRecentCoachClaim } = await import("./model");
    const state = setup(),
      now = new Date("2026-09-16T18:15:00Z");
    outreach(state, [plan], now, true);
    Object.values(state.checks)[0].claimedAt = now.toISOString();
    expect(hasRecentCoachClaim(state, now)).toBe(true);
    expect(hasRecentCoachClaim(state, new Date("2026-09-18T18:15:00Z"))).toBe(
      false,
    );
    updateSilence(state, new Date("2026-10-01T18:15:00Z"));
    expect(state.pausedAt).toBeNull();
  });
  it("counts unique local activity days for a specific, honest weekly check", async () => {
    const { weeklyMessage } = await import("./model");
    const entries = [
      "2026-09-12T23:30:00Z",
      "2026-09-13T09:00:00Z",
      "2026-09-10T09:00:00Z",
    ].map((date, i) => ({
      id: String(i),
      datetime: new Date(date),
      activityId: "a",
      deletedAt: null,
    }));
    expect(weeklyMessage(plan, config(), entries, "2026-09-15")).toContain(
      "2 days logged",
    );
    expect(weeklyMessage(plan, config(), [], "2026-09-15")).not.toContain(
      "failed",
    );
  });
});

describe("flexible weekly tracking", () => {
  it("does not turn old session records into reminders or missed-session checks", () => {
    const state = setup();
    state.supports.p.mode = "WEEKLY";
    expect(
      outreach(state, [plan], new Date("2026-09-16T16:30:00Z"), true),
    ).toEqual([]);
    expect(
      outreach(state, [plan], new Date("2026-09-16T18:15:00Z"), true),
    ).toEqual([]);
    expect(Object.values(state.checks)).toEqual([]);
  });
  it("only checks a completed week after opt-in, at the agreed weekly time", () => {
    const state = setup();
    state.supports.p.mode = "WEEKLY";
    state.supports.p.preferences.weeklyReview = true;
    const now = new Date("2026-09-20T17:00:00Z");
    expect(outreach(state, [plan], now, true)).toEqual([]);
    state.supports.p.effectiveDate = "2026-09-06";
    const checks = outreach(state, [plan], now, true);
    expect(checks).toHaveLength(1);
    expect(checks[0].sessionId).toBeNull();
    expect(checks[0].body).toContain("0 of 3 days logged last week");
  });
  it("retires an old flexible timer without inventing a completion", () => {
    const state = setup();
    const session = state.sessions["repeat:p:2026-09-16"];
    session.timerRunning = true;
    session.startedAt = "2026-09-16T17:00:00Z";
    state.supports.p.mode = "WEEKLY";
    materialize(state, [plan], new Date("2026-09-16T17:01:00Z"));
    expect(session.elapsedSeconds).toBe(60);
    expect(session.timerRunning).toBe(false);
    expect(session.outcome).toBe("UNCONFIRMED");
  });
  it("reviews the completed calendar week, not a sliding window or invented slots", async () => {
    const { weeklyMessage } = await import("./model");
    const support = { ...config(), mode: "WEEKLY" as const };
    const entries = [
      "2026-09-07T12:00:00Z",
      "2026-09-09T12:00:00Z",
      "2026-09-11T12:00:00Z",
      "2026-09-14T12:00:00Z",
    ].map((datetime, i) => ({
      id: String(i),
      activityId: "a",
      datetime: new Date(datetime),
      deletedAt: null,
    }));
    expect(weeklyMessage(plan, support, entries, "2026-09-15")).toBe(
      "Guitar: 3 of 3 days logged last week. Your weekly goal is complete.",
    );
    const missing = weeklyMessage(plan, support, [], "2026-09-15");
    expect(missing).toContain("0 of 3 days logged last week");
    expect(missing).not.toMatch(/slot|session|failed/);
  });
});
