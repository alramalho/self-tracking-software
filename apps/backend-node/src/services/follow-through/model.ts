import { addDays, format, startOfWeek } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import type {
  FollowThroughState,
  PlanSupport,
  PracticeSession,
} from "@tsw/prisma/follow-through";
import type {
  PendingOutreach,
  SupportPlanRecord,
  LoggedSessionEntry,
} from "./types";

export const initialState = (): FollowThroughState => ({
  version: 1,
  enabled: false,
  pausedAt: null,
  supports: {},
  sessions: {},
  checks: {},
  draft: null,
});
export const localDate = (now: Date, timezone: string) =>
  formatInTimeZone(now, timezone, "yyyy-MM-dd");
export function calendarDay(date: string, offset: number) {
  return format(addDays(new Date(`${date}T12:00:00`), offset), "yyyy-MM-dd");
}
export function instant(date: string, time: string, timezone: string) {
  const utc = fromZonedTime(`${date}T${time}:00`, timezone);
  // Reject nonexistent wall-clock slots during spring-forward instead of silently shifting them.
  if (
    !Number.isFinite(utc.getTime()) ||
    formatInTimeZone(utc, timezone, "yyyy-MM-dd HH:mm") !== `${date} ${time}`
  )
    return null;
  return utc;
}
export function isActive(plan: SupportPlanRecord, date: string) {
  return (
    !plan.deletedAt &&
    !plan.archivedAt &&
    !plan.isPaused &&
    (!plan.finishingDate ||
      plan.finishingDate.toISOString().slice(0, 10) >= date)
  );
}
export function sessionFor(
  id: string,
  planId: string,
  activityId: string,
  date: string,
  support: PlanSupport,
  source: PracticeSession["source"],
): PracticeSession {
  return {
    id,
    planId,
    activityId,
    date,
    time: support.mode === "TIMED" ? support.time : null,
    timezone: support.timezone,
    durationMinutes: support.durationMinutes,
    outcome: "UNCONFIRMED",
    entryId: null,
    startedAt: null,
    elapsedSeconds: 0,
    timerRunning: false,
    source,
  };
}
/** Reconciliation is deterministic and preserves explicit skips, outcomes, moves and timers. */
export function materialize(
  state: FollowThroughState,
  plans: SupportPlanRecord[],
  now: Date,
) {
  for (const plan of plans) {
    const support = state.supports[plan.id];
    if (!support) continue;
    if (support.mode === "WEEKLY" && plan.outlineType !== "SPECIFIC") {
      // Keep historical records, but retire the session timer from the old flexible flow.
      for (const session of Object.values(state.sessions)) {
        if (session.planId !== plan.id || !session.timerRunning) continue;
        if (session.startedAt)
          session.elapsedSeconds += Math.max(
            0,
            Math.floor((now.getTime() - Date.parse(session.startedAt)) / 1000),
          );
        session.timerRunning = false;
        session.startedAt = null;
      }
      continue;
    }
    const today = localDate(now, support.timezone);
    if (!isActive(plan, today)) continue;
    const activeActivities = plan.activities.filter((a) => !a.deletedAt);
    for (const row of plan.sessions) {
      const day = row.date.toISOString().slice(0, 10);
      if (
        day < calendarDay(today, -14) ||
        day > calendarDay(today, 35) ||
        !activeActivities.some((a) => a.id === row.activityId)
      )
        continue;
      const id = `existing:${row.id}`;
      if (!state.sessions[id])
        state.sessions[id] = sessionFor(
          id,
          plan.id,
          row.activityId,
          day,
          support,
          "EXISTING",
        );
    }
    if (support.mode === "WEEKLY" || !activeActivities.length) continue;
    for (let offset = 0; offset < 35; offset++) {
      const day = calendarDay(today, offset);
      if (day < support.effectiveDate || !isActive(plan, day)) continue;
      const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
      if (!support.weekdays.includes(weekday)) continue;
      // Existing prescribed content wins: never invent an extra workout alongside it.
      if (plan.sessions.some((s) => s.date.toISOString().slice(0, 10) === day))
        continue;
      const id = `repeat:${plan.id}:${day}`;
      if (!state.sessions[id])
        state.sessions[id] = sessionFor(
          id,
          plan.id,
          activeActivities[0].id,
          day,
          support,
          "RECURRING",
        );
    }
  }
}
export function dueForSession(session: PracticeSession, support: PlanSupport) {
  const beginning = session.time
    ? instant(session.date, session.time, session.timezone)
    : null;
  const reminder = beginning
    ? new Date(
        beginning.getTime() - support.preferences.reminderMinutes * 60000,
      )
    : instant(
        session.date,
        support.preferences.dayReminderTime,
        session.timezone,
      );
  const check = beginning
    ? new Date(beginning.getTime() + (session.durationMinutes + 15) * 60000)
    : instant(
        calendarDay(session.date, 1),
        support.preferences.checkInTime,
        session.timezone,
      );
  return { reminder, check };
}
export function updateSilence(
  state: FollowThroughState,
  now: Date,
  flexiblePlanIds: string[] = [],
) {
  const answered = Object.values(state.checks)
    .filter((c) => c.answeredAt)
    .map((c) => Date.parse(c.answeredAt!));
  const lastAnswer = Math.max(0, ...answered);
  const unanswered = Object.values(state.checks).filter(
    (c) =>
      !state.supports[c.planId]?.coaching &&
      !(c.kind === "SESSION" && flexiblePlanIds.includes(c.planId)) &&
      c.sentAt &&
      !c.answeredAt &&
      Date.parse(c.sentAt) > lastAnswer &&
      now.getTime() - Date.parse(c.sentAt) >= 24 * 3600000,
  );
  if (unanswered.length >= 2 && !state.pausedAt)
    state.pausedAt = now.toISOString();
}
export function outreach(
  state: FollowThroughState,
  plans: SupportPlanRecord[],
  now: Date,
  canCoach: boolean,
  entries: LoggedSessionEntry[] = [],
): PendingOutreach[] {
  if (!state.enabled) return [];
  updateSilence(
    state,
    now,
    plans
      .filter(
        (p) =>
          p.outlineType !== "SPECIFIC" &&
          state.supports[p.id]?.mode === "WEEKLY",
      )
      .map((p) => p.id),
  );
  const result: PendingOutreach[] = [];
  const eligible = (d: Date | null): d is Date =>
    !!d &&
    d.getTime() <= now.getTime() &&
    now.getTime() - d.getTime() < 10 * 60000;
  for (const session of Object.values(state.sessions)) {
    const plan = plans.find((p) => p.id === session.planId),
      support = state.supports[session.planId];
    if (
      !plan ||
      !support ||
      (support.mode === "WEEKLY" && plan.outlineType !== "SPECIFIC") ||
      !isActive(plan, localDate(now, support.timezone)) ||
      session.outcome !== "UNCONFIRMED" ||
      session.timerRunning
    )
      continue;
    const times = dueForSession(session, support);
    if (support.preferences.reminder && eligible(times.reminder))
      result.push({
        id: `remind:${session.id}:${times.reminder.toISOString()}`,
        planId: plan.id,
        sessionId: session.id,
        checkId: null,
        title: plan.goal,
        body: session.time
          ? `Your session starts at ${session.time}.`
          : "On your plan today. Pick a time that works for you.",
        dueAt: times.reminder.toISOString(),
      });
    if (
      canCoach &&
      support.preferences.coaching &&
      support.preferences.checkIn &&
      !support.coaching &&
      !state.pausedAt &&
      eligible(times.check)
    ) {
      const id = `check:${session.id}:${times.check.toISOString()}`;
      if (!state.checks[id])
        state.checks[id] = {
          id,
          planId: plan.id,
          sessionId: session.id,
          kind: "SESSION",
          dueAt: times.check.toISOString(),
          sentAt: null,
          answeredAt: null,
          dismissedAt: null,
          message: `Did your ${plan.activities.find((a) => a.id === session.activityId)?.title ?? "planned"} session happen?`,
        };
      const check = state.checks[id];
      if (!check.sentAt && !check.answeredAt && !check.dismissedAt)
        result.push({
          id,
          planId: plan.id,
          sessionId: session.id,
          checkId: id,
          title: "One quick check",
          body: check.message,
          dueAt: check.dueAt,
        });
    }
  }
  for (const support of Object.values(state.supports)) {
    const plan = plans.find((p) => p.id === support.planId);
    if (
      !canCoach ||
      state.pausedAt ||
      !support.preferences.coaching ||
      !support.preferences.weeklyReview ||
      support.coaching ||
      !plan
    )
      continue;
    const today = localDate(now, support.timezone);
    if (
      !isActive(plan, today) ||
      new Date(`${today}T12:00:00Z`).getUTCDay() !==
        support.preferences.reviewDay
    )
      continue;
    if (support.mode === "WEEKLY" && plan.outlineType !== "SPECIFIC") {
      const completedWeekEnd = format(
        startOfWeek(new Date(`${today}T12:00:00`), { weekStartsOn: 0 }),
        "yyyy-MM-dd",
      );
      if (support.effectiveDate > calendarDay(completedWeekEnd, -7)) continue;
    }
    const due = instant(
      today,
      support.preferences.reviewTime,
      support.timezone,
    );
    if (!eligible(due)) continue;
    const week = format(
      startOfWeek(new Date(`${today}T12:00:00`), { weekStartsOn: 1 }),
      "yyyy-MM-dd",
    );
    const id = `week:${plan.id}:${week}`;
    if (!state.checks[id])
      state.checks[id] = {
        id,
        planId: plan.id,
        sessionId: null,
        kind: "WEEKLY",
        dueAt: due.toISOString(),
        sentAt: null,
        answeredAt: null,
        dismissedAt: null,
        message: weeklyMessage(plan, support, entries, today),
      };
    const check = state.checks[id];
    if (!check.sentAt && !check.answeredAt && !check.dismissedAt)
      result.push({
        id,
        planId: plan.id,
        sessionId: null,
        checkId: id,
        title: "Your agreed weekly check",
        body: check.message,
        dueAt: check.dueAt,
      });
  }
  return result;
}

/** A single real log can resolve a single unambiguous session. Ambiguous days stay for the user to link. */
export function reconcileEntries(
  state: FollowThroughState,
  entries: LoggedSessionEntry[],
  now: Date,
) {
  const used = new Set(
    Object.values(state.sessions)
      .map((s) => s.entryId)
      .filter(Boolean),
  );
  // A late log still wins over a session the coach only assumed was missed.
  const open = (s: PracticeSession) =>
    s.outcome === "UNCONFIRMED" || !!s.assumedMissed;
  for (const session of Object.values(state.sessions)) {
    if (!open(session) || session.timerRunning) continue;
    const candidates = entries.filter(
      (e) =>
        !e.deletedAt &&
        !used.has(e.id) &&
        e.activityId === session.activityId &&
        localDate(e.datetime, session.timezone) === session.date,
    );
    const peers = Object.values(state.sessions).filter(
      (s) =>
        open(s) &&
        s.activityId === session.activityId &&
        s.date === session.date,
    );
    if (candidates.length !== 1 || peers.length !== 1) continue;
    session.entryId = candidates[0].id;
    session.outcome = "DONE";
    delete session.assumedMissed;
    used.add(candidates[0].id);
    for (const check of Object.values(state.checks))
      if (check.sessionId === session.id) check.answeredAt = now.toISOString();
    for (const request of state.monitoring?.requests ?? [])
      if (request.sessionId === session.id && !request.resolvedAt && !request.closedAt) request.resolvedAt = now.toISOString();
  }
}

/** Summarize real logs without treating missing records as proof someone did nothing. */
export function weeklyMessage(
  plan: SupportPlanRecord,
  support: PlanSupport,
  entries: LoggedSessionEntry[],
  today: string,
) {
  const flexible = support.mode === "WEEKLY" && plan.outlineType !== "SPECIFIC";
  const through = flexible
    ? format(
        startOfWeek(new Date(`${today}T12:00:00`), { weekStartsOn: 0 }),
        "yyyy-MM-dd",
      )
    : today;
  const from = calendarDay(through, -7);
  const days = new Set(
    entries
      .filter(
        (entry) =>
          !entry.deletedAt &&
          plan.activities.some((a) => a.id === entry.activityId) &&
          localDate(entry.datetime, support.timezone) >= from &&
          localDate(entry.datetime, support.timezone) < through,
      )
      .map((entry) => localDate(entry.datetime, support.timezone)),
  ).size;
  const target = plan.timesPerWeek;
  if (flexible) {
    const progress = `${plan.goal}: ${days}${target ? ` of ${target}` : ""} days logged last week.`;
    return target && days >= target
      ? `${progress} Your weekly goal is complete.`
      : `${progress} Keep the same goal, or adjust it? Log whenever it works for you.`;
  }
  const progress = `${plan.goal}: ${days} ${days === 1 ? "day" : "days"} logged in the past 7 days${target ? ` · target ${target}/week` : ""}.`;
  return `${progress} ${target && days >= target ? "Keep this rhythm?" : "Keep the plan, choose a slot, or make it easier to start?"}`;
}
export function hasRecentCoachClaim(state: FollowThroughState, now: Date) {
  if (state.monitoring?.lease && Date.parse(state.monitoring.lease.until) > now.getTime()) return true;
  if (state.monitoring?.lastOutreachAt && now.getTime() - Date.parse(state.monitoring.lastOutreachAt) < 24 * 3600000) return true;
  return Object.values(state.checks).some((check) => {
    const last = check.sentAt || check.claimedAt;
    return !!last && now.getTime() - Date.parse(last) < 24 * 3600000;
  });
}
