import {
  Activity,
  Plan,
  PlanMilestone,
  PlanSession,
  User,
} from "@tsw/prisma";
import {
  differenceInCalendarDays,
  isSameDay,
  startOfDay,
  subDays,
} from "date-fns";
import { prisma } from "../../../utils/prisma";
import { plansService } from "../../plansService";
import {
  deriveCoachAttentionItems,
  type CoachAttentionItem,
} from "../../coachAttentionService";
import {
  daysSinceExternalAgentSync,
  EXTERNAL_AGENT_FRESH_DAYS,
  isExternalAgentManaged,
  parseStatusDaysBehind,
  readExternalAgentStatusFile,
} from "../externalAgentPresence";
import type { ConcernObservation } from "./types";

export type DetectorPlan = Plan & {
  activities: Activity[];
  sessions: PlanSession[];
  milestones: PlanMilestone[];
};
export type DetectorUser = User & { plans: DetectorPlan[] };

// Concern kinds — materialized *problems* only. Positive/cadence angles
// (celebration, week recap/start, session prep) are lenses, not concerns.
export const CONCERN_KIND = {
  INACTIVITY_ARCHIVE: "inactivity_archive",
  INACTIVITY_PAUSE: "inactivity_pause",
  INACTIVITY_CHECKIN: "inactivity_checkin",
  PLAN_ADJUSTMENT: "plan_adjustment",
  // User-level: tracks metrics but has stopped logging them. Modeled as a concern
  // (not a lens) so it dedupes and auto-resolves the moment they log again.
  METRIC_LOGGING_GAP: "metric_logging_gap",
  // Connected agent owns this plan's week content but has stopped syncing
  // while the user is still logging. Auto-resolves on the next agent write.
  AGENT_SYNC_STALE: "agent_sync_stale",
  // Forward-looking pace-vs-deadline drift: overdue milestones or the agent's
  // status file reporting the user materially behind schedule.
  DEADLINE_AT_RISK: "deadline_at_risk",
} as const;

// Severity ordering mirrors the legacy INTERVENTION_PRIORITY for the problem
// interventions so the reconciler picks the same one the old selector would.
const SEVERITY = {
  INACTIVITY_ARCHIVE: 90,
  INACTIVITY_PAUSE: 80,
  ATTENTION_BASE: 70,
  // Deadline drift outranks week-level adjustment: it is the goal itself slipping.
  DEADLINE_AT_RISK: 65,
  PLAN_ADJUSTMENT: 60,
  // Sync-hygiene nudge: above a plain check-in, far below real problems.
  AGENT_SYNC_STALE: 25,
  INACTIVITY_CHECKIN: 20,
  // Lowest priority: only surfaces in a quiet week, never displaces a real problem.
  METRIC_LOGGING_GAP: 15,
} as const;

const METRIC_GAP_LOOKBACK_DAYS = 14;

function attentionSeverityBump(severity: CoachAttentionItem["severity"]): number {
  if (severity === "critical") return 20;
  if (severity === "warning") return 5;
  return 0;
}

function attentionKind(item: CoachAttentionItem): string {
  return `attention_${item.kind.toLowerCase()}`;
}

// Raw, as-of-T adherence summary. Mirrors buildPlanAssessmentSummary's raw math,
// but the week state comes from the clock-injectable computeCurrentWeekState
// instead of the plan.currentWeekState cache.
export async function summarizePlanAdherenceAsOf(
  user: DetectorUser,
  plan: DetectorPlan,
  now: Date
) {
  const sevenDaysAgo = subDays(now, 7);
  const ninetyDaysAgo = subDays(now, 90);
  const activityIds = plan.activities.map((a) => a.id);

  const entries =
    activityIds.length > 0
      ? await prisma.activityEntry.findMany({
          where: {
            userId: user.id,
            deletedAt: null,
            activityId: { in: activityIds },
            datetime: { gte: ninetyDaysAgo, lte: now },
          },
          orderBy: { datetime: "desc" },
        })
      : [];

  const lastEntry = entries[0];
  const daysSinceLastActivity = lastEntry
    ? differenceInCalendarDays(now, lastEntry.datetime)
    : null;

  const sessionsThisWeek = plan.sessions.filter(
    (s) => s.date >= startOfDay(sevenDaysAgo) && s.date < startOfDay(now)
  );
  const completedSessionsThisWeek = sessionsThisWeek.filter((session) =>
    entries.some(
      (entry) =>
        entry.activityId === session.activityId &&
        isSameDay(entry.datetime, session.date)
    )
  ).length;
  const missedSessionsThisWeek =
    sessionsThisWeek.length - completedSessionsThisWeek;

  const weekState = await plansService.computeCurrentWeekState(plan, user, now);

  return {
    planId: plan.id,
    goal: plan.goal,
    daysSinceLastActivity,
    totalSessionsThisWeek: sessionsThisWeek.length,
    completedSessionsThisWeek,
    missedSessionsThisWeek,
    weekState,
  };
}

// Produce the full set of concern observations true for this user as-of `now`.
// Pure read: no DB writes, no LLM. The orchestrator persists the result.
export async function detectConcernsForUser(
  user: DetectorUser,
  now: Date
): Promise<ConcernObservation[]> {
  const observations: ConcernObservation[] = [];

  // 1. Plan-attention items (already as-of-T; reads raw data only).
  const attentionItems = deriveCoachAttentionItems({
    user,
    plans: user.plans,
    now,
  });
  for (const item of attentionItems) {
    observations.push({
      userId: user.id,
      planId: item.planIds[0] ?? null,
      kind: attentionKind(item),
      severity: SEVERITY.ATTENTION_BASE + attentionSeverityBump(item.severity),
      data: { attentionItem: item as unknown as Record<string, unknown> },
    });
  }

  // 2. Per-plan adherence-derived concerns.
  for (const plan of user.plans) {
    const summary = await summarizePlanAdherenceAsOf(user, plan, now);
    const days = summary.daysSinceLastActivity;

    if (days !== null && days >= 30) {
      observations.push({
        userId: user.id,
        planId: plan.id,
        kind: CONCERN_KIND.INACTIVITY_ARCHIVE,
        severity: SEVERITY.INACTIVITY_ARCHIVE,
        data: { ...summary },
      });
    } else if (days !== null && days >= 14) {
      observations.push({
        userId: user.id,
        planId: plan.id,
        kind: CONCERN_KIND.INACTIVITY_PAUSE,
        severity: SEVERITY.INACTIVITY_PAUSE,
        data: { ...summary },
      });
    } else if (days !== null && days >= 7) {
      observations.push({
        userId: user.id,
        planId: plan.id,
        kind: CONCERN_KIND.INACTIVITY_CHECKIN,
        severity: SEVERITY.INACTIVITY_CHECKIN,
        data: { ...summary },
      });
    }

    if (
      summary.missedSessionsThisWeek >= 3 ||
      summary.weekState === "AT_RISK" ||
      summary.weekState === "FAILED"
    ) {
      observations.push({
        userId: user.id,
        planId: plan.id,
        kind: CONCERN_KIND.PLAN_ADJUSTMENT,
        severity: SEVERITY.PLAN_ADJUSTMENT,
        data: { ...summary },
      });
    }

    const agentSyncStale = detectAgentSyncStale(plan, summary, now);
    if (agentSyncStale) {
      observations.push({
        userId: user.id,
        planId: plan.id,
        kind: CONCERN_KIND.AGENT_SYNC_STALE,
        severity: SEVERITY.AGENT_SYNC_STALE,
        data: agentSyncStale,
      });
    }

    const deadlineAtRisk = await detectDeadlineAtRisk(plan, now);
    if (deadlineAtRisk) {
      observations.push({
        userId: user.id,
        planId: plan.id,
        kind: CONCERN_KIND.DEADLINE_AT_RISK,
        severity: SEVERITY.DEADLINE_AT_RISK,
        data: deadlineAtRisk,
      });
    }
  }

  // 3. User-level: metric-logging gap (no plan).
  const metricGap = await detectMetricLoggingGap(user.id, now);
  if (metricGap) {
    observations.push({
      userId: user.id,
      planId: null,
      kind: CONCERN_KIND.METRIC_LOGGING_GAP,
      severity: SEVERITY.METRIC_LOGGING_GAP,
      data: metricGap,
    });
  }

  return observations;
}

const DEADLINE_STATUS_DAYS_BEHIND_THRESHOLD = 7;

// The plan's week content is owned by a connected agent that has stopped
// syncing (>= 3 days) while the user is still logging. The 2x2: if the user
// is also inactive, the inactivity concerns own the conversation instead.
function detectAgentSyncStale(
  plan: DetectorPlan,
  summary: Awaited<ReturnType<typeof summarizePlanAdherenceAsOf>>,
  now: Date
): Record<string, unknown> | null {
  if (!isExternalAgentManaged(plan)) return null;

  const daysSinceSync = daysSinceExternalAgentSync(plan, now);
  const daysSincePlanCreated = differenceInCalendarDays(now, plan.createdAt);
  const neverSyncedLongEnough =
    daysSinceSync === null &&
    daysSincePlanCreated >= EXTERNAL_AGENT_FRESH_DAYS;
  const syncIsStale =
    daysSinceSync !== null && daysSinceSync >= EXTERNAL_AGENT_FRESH_DAYS;
  if (!neverSyncedLongEnough && !syncIsStale) return null;

  const userStillActive =
    summary.daysSinceLastActivity !== null &&
    summary.daysSinceLastActivity <= 7;
  if (!userStillActive) return null;

  return {
    goal: plan.goal,
    daysSinceAgentSync: daysSinceSync,
    daysSinceLastActivity: summary.daysSinceLastActivity,
    summary:
      daysSinceSync === null
        ? `"${plan.goal}" is marked as planned by a connected agent, but the agent has never synced.`
        : `The connected agent planning "${plan.goal}" has not synced in ${daysSinceSync} days while the user kept logging.`,
  };
}

// Forward-looking deadline drift: an overdue milestone below 100%, or the
// connected agent's status file reporting the user materially behind.
async function detectDeadlineAtRisk(
  plan: DetectorPlan,
  now: Date
): Promise<Record<string, unknown> | null> {
  const overdueMilestones = plan.milestones
    .filter(
      (milestone) => milestone.date < now && (milestone.progress ?? 0) < 100
    )
    .map((milestone) => ({
      description: milestone.description,
      date: milestone.date,
      progress: milestone.progress ?? 0,
      daysOverdue: differenceInCalendarDays(now, milestone.date),
    }));

  let statusDaysBehind: number | null = null;
  if (isExternalAgentManaged(plan)) {
    const statusFile = await readExternalAgentStatusFile(plan.id);
    if (statusFile) statusDaysBehind = parseStatusDaysBehind(statusFile);
  }
  const materiallyBehind =
    statusDaysBehind !== null &&
    statusDaysBehind >= DEADLINE_STATUS_DAYS_BEHIND_THRESHOLD;

  if (overdueMilestones.length === 0 && !materiallyBehind) return null;

  const parts: string[] = [];
  if (overdueMilestones.length > 0) {
    const worst = overdueMilestones[0];
    parts.push(
      `Milestone "${worst.description}" was due ${worst.daysOverdue} day${worst.daysOverdue === 1 ? "" : "s"} ago at ${worst.progress}% progress.`
    );
  }
  if (materiallyBehind) {
    parts.push(
      `The connected agent reports the user ${statusDaysBehind} days behind schedule.`
    );
  }

  return {
    goal: plan.goal,
    finishingDate: plan.finishingDate,
    overdueMilestones,
    statusDaysBehind,
    summary: parts.join(" "),
  };
}

// The user tracks at least one metric but has logged none in the lookback window.
// Returns the concern's evidence, or null when there is nothing to nudge.
async function detectMetricLoggingGap(
  userId: string,
  now: Date
): Promise<Record<string, unknown> | null> {
  const from = subDays(now, METRIC_GAP_LOOKBACK_DAYS);
  const [metricCount, entriesInLookback, latestEntry] = await Promise.all([
    prisma.metric.count({ where: { userId } }),
    prisma.metricEntry.count({
      where: { userId, createdAt: { gte: from, lte: now } },
    }),
    prisma.metricEntry.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  if (metricCount === 0 || entriesInLookback > 0) return null;

  const daysSinceLastLog = latestEntry
    ? differenceInCalendarDays(now, latestEntry.createdAt)
    : null;

  return {
    metricCount,
    daysSinceLastLog,
    lookbackDays: METRIC_GAP_LOOKBACK_DAYS,
    summary:
      daysSinceLastLog === null
        ? `Tracks ${metricCount} metric${metricCount === 1 ? "" : "s"} but has never logged an entry.`
        : `Tracks ${metricCount} metric${metricCount === 1 ? "" : "s"} but has not logged a metric in ${daysSinceLastLog} days.`,
  };
}
