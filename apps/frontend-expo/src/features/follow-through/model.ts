import { format, startOfWeek, addDays } from "date-fns";
import type { PlanSupport, PracticeSession } from "@tsw/prisma/follow-through";
import type { Plan, ActivityEntry } from "@/core/types";
import type { SessionViewData } from "./types";
export const localDay = (date = new Date()) => format(date, "yyyy-MM-dd");
export const defaultSupport = (plan: Plan): PlanSupport => ({
  planId: plan.id,
  mode: "WEEKLY",
  weekdays: [],
  time: null,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  durationMinutes: 20,
  format: "LOG",
  resourceUrl: null,
  resourceName: null,
  nextStep: "",
  effectiveDate: localDay(),
  preferences: {
    coaching: false,
    reminder: false,
    reminderMinutes: 30,
    dayReminderTime: "09:00",
    checkIn: false,
    checkInTime: "10:00",
    weeklyReview: false,
    reviewDay: 0,
    reviewTime: "18:00",
  },
});
export const isFlexiblePlan = (plan: Plan, support?: PlanSupport) =>
  plan.outlineType !== "SPECIFIC" && (support?.mode ?? "WEEKLY") === "WEEKLY";

export function planLogPath(plan: Plan) {
  const activities = plan.activities.filter((activity) => !activity.deletedAt);
  return activities.length === 1
    ? `/add?activityId=${encodeURIComponent(activities[0].id)}`
    : "/add";
}

export const activePlans = (plans: Plan[], now = new Date()) =>
  plans.filter(
    (p) =>
      !p.deletedAt &&
      !p.archivedAt &&
      !p.isPaused &&
      (!p.finishingDate ||
        String(p.finishingDate).slice(0, 10) >= localDay(now)),
  );
export function visibleSessions({
  state,
  plans,
  now = new Date(),
}: SessionViewData): PracticeSession[] {
  const active = activePlans(plans, now);
  const sessions = Object.values(state?.sessions ?? {}).filter((s) =>
    active.some(
      (p) => p.id === s.planId && !isFlexiblePlan(p, state?.supports[p.id]),
    ),
  );
  // Existing date-only plans remain visible before the user enables any new support.
  for (const plan of active.filter(
    (p) => !isFlexiblePlan(p, state?.supports[p.id]),
  ))
    for (const row of plan.sessions ?? []) {
      const id = `existing:${row.id}`;
      if (sessions.some((s) => s.id === id)) continue;
      const support = state?.supports[plan.id] ?? defaultSupport(plan);
      sessions.push({
        id,
        planId: plan.id,
        activityId: row.activityId,
        date: String(row.date).slice(0, 10),
        time: null,
        timezone: support.timezone,
        durationMinutes: support.durationMinutes,
        outcome: "UNCONFIRMED",
        entryId: null,
        startedAt: null,
        elapsedSeconds: 0,
        timerRunning: false,
        source: "EXISTING",
      });
    }
  return sessions.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.time ?? "99:99").localeCompare(b.time ?? "99:99") ||
      a.id.localeCompare(b.id),
  );
}
export function completedDays(
  plan: Plan,
  entries: ActivityEntry[],
  date = new Date(),
) {
  const start = localDay(startOfWeek(date, { weekStartsOn: 0 })),
    end = localDay(addDays(startOfWeek(date, { weekStartsOn: 0 }), 7));
  return new Set(
    entries
      .filter(
        (e) =>
          !e.deletedAt &&
          plan.activities.some((a) => a.id === e.activityId) &&
          localDay(new Date(e.datetime)) >= start &&
          localDay(new Date(e.datetime)) < end,
      )
      .map((e) => localDay(new Date(e.datetime))),
  ).size;
}
export function timerSeconds(session: PracticeSession, now = Date.now()) {
  return (
    session.elapsedSeconds +
    (session.timerRunning && session.startedAt
      ? Math.max(0, Math.floor((now - Date.parse(session.startedAt)) / 1000))
      : 0)
  );
}
export function clockLabel(seconds: number) {
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}
