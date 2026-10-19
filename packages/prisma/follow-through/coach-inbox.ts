// The Coach tab's rules, shared by the iPhone app and the web app so both always agree:
// the coaching switches, when a plan needs you, and what the coach is waiting on you for.
import { planPace, weekAtRisk } from "./pace";
import type { MissedWeek } from "./streak";
import type { CoachRequest } from "./coaching";
import type { CoachCheck, FollowThroughState, PlanSupport } from "./types";
import { addDaysToDateKey, dateKeyToUTCDate, getPlanWeekDateKey, getPlanWeekStartKey } from "../plan-week";

type DateValue = Date | string;

/** The parts of a plan these rules read; both apps' plan types fit it. */
export interface CoachPlan {
  id: string;
  goal: string;
  emoji?: string | null;
  outlineType?: string | null;
  timesPerWeek?: number | null;
  orientation?: string | null;
  createdAt: DateValue;
  finishingDate?: DateValue | null;
  archivedAt?: DateValue | null;
  deletedAt?: DateValue | null;
  activities: { id: string }[];
  progress?: {
    weeks?: { startDate: DateValue; plannedActivities?: unknown }[];
    achievement?: { missedLastWeek?: MissedWeek | null } | null;
  } | null;
}
export interface CoachEntry {
  activityId?: string | null;
  datetime: DateValue;
  deletedAt?: DateValue | null;
}
export interface CoachAttention {
  dedupeKey: string;
  title: string;
  planGoal: string;
  planEmoji: string | null;
  planIds: string[];
  generatedAt: string;
  primaryAction: { prompt: string };
}
export interface CoachMetric {
  id: string;
  title: string;
  emoji: string;
}

export interface PlanAlert<P extends CoachPlan = CoachPlan> {
  plan: P;
  status: "quiet" | "at_risk" | "missed";
  quietDays: number;
  /** Sessions still needed this week, and days left to fit them. */
  needed: number;
  daysLeft: number;
  missed: MissedWeek | null;
  /** The coach's silent "gone quiet" message, when it sent one. */
  nudge?: CoachRequest;
}

interface ItemBase {
  id: string;
  /** One short line for the Recent row. */
  title: string;
  /** The second line: a fact, the plan, or the kind of check. */
  label: string;
  emoji: string;
  at: string;
}
/** Everything the coach is waiting on you for, as one list. */
export type CoachItem<P extends CoachPlan = CoachPlan, A extends CoachAttention = CoachAttention, M extends CoachMetric = CoachMetric> =
  | (ItemBase & { kind: "alert"; alert: PlanAlert<P> })
  | (ItemBase & { kind: "request"; request: CoachRequest; plan?: P })
  | (ItemBase & { kind: "check"; check: CoachCheck; plan?: P })
  | (ItemBase & { kind: "attention"; attention: A })
  | (ItemBase & { kind: "checkin"; metrics: M[] });

export interface CoachItemsInput<P extends CoachPlan, A extends CoachAttention, M extends CoachMetric> {
  plans: P[];
  entries: CoachEntry[];
  state?: FollowThroughState;
  attention: A[];
  metrics: M[];
  checkedInToday: boolean;
  /** Plans whose missed week was already answered on this device. */
  answeredMisses: string[];
  now?: Date;
}

// ---------- dates (local, weeks start on Sunday) ----------

const dayKey = (value: DateValue) => getPlanWeekDateKey(value);
const daysBetween = (from: DateValue, to: DateValue) =>
  Math.round((dateKeyToUTCDate(dayKey(to)).getTime() - dateKeyToUTCDate(dayKey(from)).getTime()) / 86_400_000);
const sameWeek = (a: DateValue, b: DateValue) => getPlanWeekStartKey(new Date(a)) === getPlanWeekStartKey(new Date(b));

// ---------- switches ----------

export const localDay = (date = new Date()) => dayKey(date);

/** A plan's support before the person has set anything up: weekly, nothing switched on. */
export const defaultSupport = (plan: Pick<CoachPlan, "id">): PlanSupport => ({
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

export const isFlexiblePlan = (plan: Pick<CoachPlan, "outlineType">, support?: PlanSupport) =>
  plan.outlineType !== "SPECIFIC" && (support?.mode ?? "WEEKLY") === "WEEKLY";

/** The master switch: the coach may reach out at all. */
export const masterOn = (state?: FollowThroughState) =>
  !!state && !state.pausedAt && !state.monitoring?.outreachPaused;

/** A plan's own coaching choice; "tracking" means the coach stays out of it. */
export function planCoachingOn(state: FollowThroughState | undefined, planId: string) {
  const support = state?.supports[planId];
  const role = support?.coaching?.role ?? (support?.preferences.coaching ? "consistency" : "tracking");
  return role !== "tracking";
}

/** The one support change a plan's switch sends. Off keeps the plan's settings; on uses onboarding's role. */
export function supportFor(state: FollowThroughState | undefined, plan: CoachPlan, on: boolean) {
  const current: PlanSupport = state?.supports[plan.id] ?? defaultSupport(plan);
  const coaching = current.coaching ?? { role: "tracking" as const, followUps: false, dataAccess: { workouts: false, sleep: false } };
  const support: PlanSupport = on
    ? {
        ...current,
        coaching: { ...coaching, role: plan.orientation === "OUTCOME" ? "training" : "consistency", followUps: true },
        preferences: { ...current.preferences, coaching: true, weeklyReview: true },
      }
    : { ...current, coaching: { ...coaching, role: "tracking" } };
  return { support, resume: on && !!state?.monitoring?.pausedPlanIds.includes(plan.id) };
}

// ---------- plan alerts ----------

/** Gone quiet, at risk this week, or missed last week: what the home card's warning and the Coach tab show. */
export function planAlert<P extends CoachPlan>(input: {
  plan: P;
  entries: CoachEntry[];
  state?: FollowThroughState;
  now?: Date;
}): PlanAlert<P> | null {
  const { plan, state, now = new Date() } = input;
  const logs = input.entries.filter((e) => !e.deletedAt && plan.activities.some((a) => a.id === e.activityId));
  const role = state?.supports[plan.id]?.coaching?.role;
  const coached = !!role && role !== "tracking";
  const nudge = coached
    ? state?.monitoring?.requests.find(
        (r) => r.kind === "nudge" && r.planIds.includes(plan.id) && !r.resolvedAt && !r.closedAt,
      )
    : undefined;
  const pace = coached
    ? planPace({
        timesPerWeek: plan.timesPerWeek,
        startedAt: new Date(plan.createdAt),
        now,
        logDates: logs.map((e) => new Date(e.datetime)),
      })
    : null;
  const week = plan.progress?.weeks?.find((w) => sameWeek(w.startDate, now));
  const target = typeof week?.plannedActivities === "number" ? week.plannedActivities : (plan.timesPerWeek ?? 0);
  const doneDays = new Set(logs.filter((e) => sameWeek(e.datetime, now)).map((e) => dayKey(e.datetime))).size;
  const daysLeft = 7 - now.getDay();
  const atRisk = plan.outlineType === "TIMES_PER_WEEK" && weekAtRisk({ target, doneDays, daysLeft });
  const missed = plan.progress?.achievement?.missedLastWeek ?? null;
  // Answering the coach's nudge (remind me tomorrow, or let it go) quiets the alert for a day.
  const answeredNudge = state?.monitoring?.requests.some(
    (r) =>
      r.kind === "nudge" &&
      r.planIds.includes(plan.id) &&
      !!r.resolvedAt &&
      now.getTime() - new Date(r.resolvedAt).getTime() < 86_400_000,
  );
  const slipping = !!nudge || (pace === "slipping" && !answeredNudge);
  if (!slipping && !atRisk && !missed) return null;
  const last = logs.reduce<DateValue>(
    (latest, e) => (new Date(e.datetime) > new Date(latest) ? e.datetime : latest),
    plan.createdAt,
  );
  return {
    plan,
    status: slipping ? "quiet" : atRisk ? "at_risk" : "missed",
    quietDays: daysBetween(last, now),
    needed: Math.max(0, target - doneDays),
    daysLeft,
    missed,
    nudge,
  };
}

export const alertTitle = (alert: PlanAlert) =>
  `${alert.plan.goal} ${alert.status === "quiet" ? "has gone quiet" : alert.status === "at_risk" ? "is at risk this week" : "missed last week"}`;

/** One short fact: the Recent row's second line and the drawer's subtitle. */
export function alertFact(alert: PlanAlert) {
  if (alert.status === "quiet") return `${alert.quietDays} ${alert.quietDays === 1 ? "day" : "days"} without a log`;
  if (alert.status === "at_risk")
    return `${alert.needed} ${alert.needed === 1 ? "session" : "sessions"} left · ${alert.daysLeft} ${alert.daysLeft === 1 ? "day" : "days"} to go`;
  const m = alert.missed;
  if (m && m.streakBefore > m.streakAfter) return `Streak ${m.streakBefore} → ${m.streakAfter}`;
  return m && m.inARow > 1 ? `${m.inARow} weeks in a row` : "Last week slipped by";
}

/** A plan alert as a coach item, for the Coach tab's list and the home card's drawer. */
export const alertItem = <P extends CoachPlan, A extends CoachAttention = CoachAttention, M extends CoachMetric = CoachMetric>(
  alert: PlanAlert<P>,
  now = new Date(),
): CoachItem<P, A, M> => ({
  kind: "alert",
  id: `alert:${alert.plan.id}`,
  title: alertTitle(alert),
  label: alertFact(alert),
  emoji: alert.plan.emoji ?? "📋",
  at: now.toISOString(),
  alert,
});

// ---------- the Coach tab's list ----------

const requestTitle: Record<string, string> = {
  setup: "Preparing your first week",
  review: "Your weekly review",
  difficulty: "How hard was that?",
  session: "Did your session happen?",
  lapse: "Checking in on you",
  conversation: "A question for you",
};

/**
 * What the coach is waiting on you for, newest first. Nudges show inside their plan's alert.
 * Only coached plans raise alerts here; "just tracking" plans keep theirs on the home card.
 * With coaching off the coach is quiet, so nothing waits on you.
 */
export function coachItems<P extends CoachPlan, A extends CoachAttention, M extends CoachMetric>(
  input: CoachItemsInput<P, A, M>,
): CoachItem<P, A, M>[] {
  const now = input.now ?? new Date();
  const { plans, state } = input;
  if (state && !masterOn(state)) return [];
  const active = plans.filter(
    (p) => !p.archivedAt && !p.deletedAt && (!p.finishingDate || new Date(p.finishingDate) >= now),
  );
  const planOf = (id?: string) => plans.find((p) => p.id === id);
  const items: CoachItem<P, A, M>[] = [];
  for (const plan of active.filter((p) => planCoachingOn(state, p.id))) {
    const alert = planAlert({ plan, entries: input.entries, state, now });
    if (!alert) continue;
    if (alert.status === "missed" && input.answeredMisses.includes(plan.id)) continue;
    items.push(alertItem<P, A, M>(alert, now));
  }
  for (const request of state?.monitoring?.requests ?? []) {
    if (!request.requiresReply || request.resolvedAt || request.closedAt || request.kind === "nudge") continue;
    const plan = planOf(request.planIds[0]);
    items.push({
      kind: "request",
      id: `request:${request.id}`,
      title: requestTitle[request.kind] ?? "A question for you",
      label: plan ? plan.goal : "Coach",
      emoji: plan?.emoji ?? "💬",
      at: request.createdAt,
      request,
      plan,
    });
  }
  for (const check of Object.values(state?.checks ?? {})) {
    if (check.answeredAt || check.dismissedAt || Date.parse(check.dueAt) > now.getTime()) continue;
    const plan = planOf(check.planId);
    if (check.kind === "SESSION" && (!plan || isFlexiblePlan(plan, state?.supports[plan.id]))) continue;
    items.push({
      kind: "check",
      id: `check:${check.id}`,
      title: check.message,
      label: check.kind === "SESSION" ? "Check-in" : "Weekly check",
      emoji: plan?.emoji ?? "✅",
      at: check.dueAt,
      check,
      plan,
    });
  }
  for (const attention of input.attention) {
    items.push({
      kind: "attention",
      id: `attention:${attention.dedupeKey}`,
      title: attention.title,
      label: attention.planGoal,
      emoji: attention.planEmoji ?? "📋",
      at: attention.generatedAt,
      attention,
    });
  }
  if (input.metrics.length && !input.checkedInToday)
    items.push({
      kind: "checkin",
      id: "checkin",
      title: "How are you feeling today?",
      label: "Daily check-in",
      emoji: input.metrics[0].emoji,
      at: now.toISOString(),
      metrics: input.metrics,
    });
  return items.sort((a, b) => b.at.localeCompare(a.at));
}

// ---------- the plan page's two weeks ----------

export interface PlanDayCells<S, F, C> {
  key: string;
  isToday: boolean;
  isPast: boolean;
  /** Any of the plan's activities was logged that day. */
  logged: boolean;
  done: C[];
  scheduled: S[];
  flexible: F[];
}

/**
 * This week and next, Sunday first, from a plan-week projection. `entries` are the plan's own logs:
 * the projection leaves scheduled days out of its completed cells, so a logged session is marked here.
 */
export function planDays<S extends { dateKey: string }, F extends { dateKey: string }, C extends { dateKey: string }>(
  projection: { weekStartKey: string; todayKey: string; scheduledSessions: S[]; flexibleCells: F[]; completedCells: C[] },
  entries: { datetime: DateValue }[] = [],
): PlanDayCells<S, F, C>[][] {
  const logged = new Set(entries.map((entry) => dayKey(entry.datetime)));
  return [0, 1].map((week) =>
    Array.from({ length: 7 }, (_, index) => {
      const key = addDaysToDateKey(projection.weekStartKey, week * 7 + index);
      return {
        key,
        isToday: key === projection.todayKey,
        isPast: key < projection.todayKey,
        logged: logged.has(key),
        done: projection.completedCells.filter((cell) => cell.dateKey === key),
        scheduled: projection.scheduledSessions.filter((session) => session.dateKey === key),
        flexible: projection.flexibleCells.filter((cell) => cell.dateKey === key),
      };
    }),
  );
}

/** What a day holds, in the order the detail card explains it. */
export function dayKind(day: { scheduled: unknown[]; done: unknown[]; flexible: unknown[] }) {
  if (day.scheduled.length) return "scheduled" as const;
  if (day.done.length) return "done" as const;
  if (day.flexible.length) return "flexible" as const;
  return "rest" as const;
}
