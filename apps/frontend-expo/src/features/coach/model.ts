import { differenceInCalendarDays, endOfWeek, isSameWeek } from "date-fns";
import { planPace, weekAtRisk } from "@tsw/prisma/follow-through/pace";
import type { FollowThroughState, PlanSupport } from "@tsw/prisma/follow-through";
import { dayKey } from "@/core/dates";
import { defaultSupport, isFlexiblePlan } from "@/features/follow-through/model";
import type { Plan } from "@/core/types";
import type { CoachItem, CoachItemsInput, PlanAlert, PlanAlertInput, SupportChange } from "./types";

// ---------- switches ----------

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
export function supportFor(
  state: FollowThroughState | undefined,
  plan: Plan,
  on: boolean,
): SupportChange {
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

const planLogs = ({ plan, entries }: Pick<PlanAlertInput, "plan" | "entries">) =>
  entries.filter((e) => !e.deletedAt && plan.activities.some((a) => a.id === e.activityId));

/** Gone quiet, at risk this week, or missed last week: the same rules the home card uses. */
export function planAlert({ plan, entries, state, now = new Date() }: PlanAlertInput): PlanAlert | null {
  const logs = planLogs({ plan, entries });
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
  const week = plan.progress?.weeks?.find((w) => isSameWeek(new Date(w.startDate), now));
  const target = typeof week?.plannedActivities === "number" ? week.plannedActivities : plan.timesPerWeek;
  const doneDays = new Set(logs.filter((e) => isSameWeek(new Date(e.datetime), now)).map((e) => dayKey(e.datetime))).size;
  const daysLeft = differenceInCalendarDays(endOfWeek(now), now) + 1;
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
  const last = logs.reduce((latest, e) => {
    const d = new Date(e.datetime);
    return d > latest ? d : latest;
  }, new Date(plan.createdAt));
  return {
    plan,
    status: slipping ? "quiet" : atRisk ? "at_risk" : "missed",
    quietDays: differenceInCalendarDays(now, last),
    needed: Math.max(0, target - doneDays),
    daysLeft,
    missed,
    nudge,
  };
}

export const alertTitle = (alert: PlanAlert) =>
  `${alert.plan.goal} ${alert.status === "quiet" ? "has gone quiet" : alert.status === "at_risk" ? "is at risk this week" : "missed last week"}`;

/** One short fact under the drawer's title. */
export function alertFact(alert: PlanAlert) {
  if (alert.status === "quiet") return `${alert.quietDays} ${alert.quietDays === 1 ? "day" : "days"} without a log`;
  if (alert.status === "at_risk")
    return `${alert.needed} ${alert.needed === 1 ? "session" : "sessions"} left · ${alert.daysLeft} ${alert.daysLeft === 1 ? "day" : "days"} to go`;
  const m = alert.missed;
  if (m && m.streakBefore > m.streakAfter) return `Streak ${m.streakBefore} → ${m.streakAfter}`;
  return m && m.inARow > 1 ? `${m.inARow} weeks in a row` : "Last week slipped by";
}

/** A plan alert as a coach item, for the Coach tab's list and the home card's drawer. */
export const alertItem = (alert: PlanAlert, now = new Date()): CoachItem => ({
  kind: "alert",
  id: `alert:${alert.plan.id}`,
  title: alertTitle(alert),
  label: alertFact(alert),
  emoji: alert.plan.emoji,
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
 */
export function coachItems(input: CoachItemsInput): CoachItem[] {
  const now = input.now ?? new Date();
  const { plans, state } = input;
  // Coaching off means the coach is quiet: nothing waits on you here.
  if (state && !masterOn(state)) return [];
  const active = plans.filter(
    (p) => !p.archivedAt && !p.deletedAt && (!p.finishingDate || new Date(p.finishingDate) >= now),
  );
  const planOf = (id?: string) => plans.find((p) => p.id === id);
  const items: CoachItem[] = [];
  for (const plan of active.filter((p) => planCoachingOn(state, p.id))) {
    const alert = planAlert({ plan, entries: input.entries, state, now });
    if (!alert) continue;
    if (alert.status === "missed" && input.answeredMisses.includes(plan.id)) continue;
    items.push(alertItem(alert, now));
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
