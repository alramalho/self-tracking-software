import { TZDate } from "@date-fns/tz";
import {
  addDaysToDateKey,
  buildPlanWeekProjection,
  dateKeyToUTCDate,
  type PlanWeekFlexibleCell,
  type PlanWeekScheduledSession,
  type PlanWeekSummary,
} from "@tsw/prisma/plan-week";
import { format } from "date-fns";
import type { AssessmentWeeklyOverviewInput } from "./types";

const WEEK_LABELS = ["This week", "Next week"] as const;
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function formatPlanLabel(plan: AssessmentWeeklyOverviewInput["plans"][number]) {
  return [plan.emoji, plan.goal].filter(Boolean).join(" ");
}

function formatActivityLabel(
  activity: NonNullable<AssessmentWeeklyOverviewInput["plans"][number]["activities"]>[number],
) {
  const title = [activity.emoji, activity.title].filter(Boolean).join(" ");
  return activity.measure ? `${title} (${activity.measure})` : title;
}

function formatPlanActivities(
  plan: AssessmentWeeklyOverviewInput["plans"][number],
) {
  const activities = plan.activities ?? [];
  if (activities.length === 0) return "none";
  return activities.map(formatActivityLabel).join(", ");
}

function formatDayLabel(dateKey: string) {
  return DAY_LABELS[dateKeyToUTCDate(dateKey).getUTCDay()] ?? dateKey;
}

function formatDateKeyList(dateKeys: string[]) {
  return dateKeys.length > 0 ? dateKeys.map(formatDayLabel).join(", ") : "none";
}

function formatPressure(summary: PlanWeekSummary) {
  if (summary.status === "overloaded") {
    return `overloaded by ${summary.overflow} session${summary.overflow === 1 ? "" : "s"}`;
  }

  if (summary.status === "at_risk") {
    return `tight, ${summary.slackDays} spare day${summary.slackDays === 1 ? "" : "s"}`;
  }

  return summary.status.replace("_", " ");
}

function isDateKeyInWeek(dateKey: string, weekStartKey: string) {
  const weekEndExclusiveKey = addDaysToDateKey(weekStartKey, 7);
  return dateKey >= weekStartKey && dateKey < weekEndExclusiveKey;
}

function formatFlexibleDays(cells: PlanWeekFlexibleCell[]) {
  const ghostDateKeys = Array.from(
    new Set(cells.filter((cell) => cell.kind === "ghost").map((cell) => cell.dateKey)),
  ).sort();
  const overflowCells = cells.filter((cell) => cell.kind === "overflow");
  const labels: string[] = ghostDateKeys.map(formatDayLabel);

  if (overflowCells.length > 0) {
    const overflowDateKey = overflowCells[0].dateKey;
    labels.push(
      `${formatDayLabel(overflowDateKey)} (+${overflowCells.length} overflow)`,
    );
  }

  return labels.length > 0 ? labels.join(", ") : "none";
}

function formatFixedSessionDays(sessions: PlanWeekScheduledSession[]) {
  const dateKeys = sessions.map((session) => session.dateKey).sort();
  return dateKeys.length > 0 ? dateKeys.map(formatDayLabel).join(", ") : "none";
}

function buildWeekSection(input: {
  label: string;
  weekStartKey: string;
  summaries: PlanWeekSummary[];
  flexibleCells: PlanWeekFlexibleCell[];
  scheduledSessions: PlanWeekScheduledSession[];
}) {
  const weekEndKey = addDaysToDateKey(input.weekStartKey, 6);
  const lines = [
    `${input.label} summary:`,
    `Window: ${input.weekStartKey} to ${weekEndKey}.`,
  ];

  for (const summary of input.summaries) {
    const planLabel = [summary.planEmoji, summary.planGoal].filter(Boolean).join(" ");
    const flexibleCells = input.flexibleCells.filter(
      (cell) =>
        cell.planId === summary.planId &&
        isDateKeyInWeek(cell.dateKey, input.weekStartKey),
    );

    lines.push(
      `- ${planLabel}: ${summary.completedDays}/${summary.target} completed days, ${summary.remaining} remaining, ${summary.openDays} open days left, ${formatPressure(summary)}.`,
    );
    lines.push(`  Completed days: ${formatDateKeyList(summary.completedDateKeys)}.`);
    lines.push(`  Suggested flexible days: ${formatFlexibleDays(flexibleCells)}.`);
  }

  const fixedSessionsByPlan = new Map<string, PlanWeekScheduledSession[]>();
  for (const session of input.scheduledSessions) {
    if (!isDateKeyInWeek(session.dateKey, input.weekStartKey)) continue;

    const existing = fixedSessionsByPlan.get(session.planId) ?? [];
    existing.push(session);
    fixedSessionsByPlan.set(session.planId, existing);
  }

  for (const sessions of fixedSessionsByPlan.values()) {
    const firstSession = sessions[0];
    if (!firstSession) continue;

    const planLabel = [firstSession.planEmoji, firstSession.planTitle]
      .filter(Boolean)
      .join(" ");
    lines.push(`- ${planLabel}: fixed sessions ${formatFixedSessionDays(sessions)}.`);
  }

  if (lines.length === 2) {
    lines.push("- none.");
  }

  return lines.join("\n");
}

export function buildAssessmentWeeklyOverview(
  input: AssessmentWeeklyOverviewInput,
) {
  const timezone = input.timezone || "UTC";
  const projection = buildPlanWeekProjection({
    plans: input.plans,
    entries: input.entries,
    now: input.now,
    timezone,
    weekCount: 2,
  });
  const today = format(new TZDate(input.now, timezone), "yyyy-MM-dd (EEEE)");
  const lines = [
    "Visible weekly overview:",
    `Today: ${today}.`,
    "Times-per-week completion rule: each unique local day with a linked activity log counts as one completion.",
    "",
    "Plan activities:",
    ...(input.plans.length > 0
      ? input.plans.map((plan) => `- ${formatPlanLabel(plan)}: ${formatPlanActivities(plan)}`)
      : ["- none"]),
    "",
  ];

  for (const [weekIndex, label] of WEEK_LABELS.entries()) {
    const weekStartKey = addDaysToDateKey(projection.weekStartKey, weekIndex * 7);
    lines.push(
      buildWeekSection({
        label,
        weekStartKey,
        summaries: projection.summaries.filter(
          (summary) => summary.weekIndex === weekIndex,
        ),
        flexibleCells: projection.flexibleCells,
        scheduledSessions: projection.scheduledSessions,
      }),
    );

    if (weekIndex < WEEK_LABELS.length - 1) {
      lines.push("");
    }
  }

  return lines.join("\n");
}
