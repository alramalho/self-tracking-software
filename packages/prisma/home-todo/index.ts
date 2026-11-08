// Shared rules for the homepage "what's next" section, so the native app and
// the PWA decide the same things from the same data.
import type {
  HomeCoachNote,
  HomeCoachNoteInput,
  HomeTodoMetric,
  HomeTodoMetricEntry,
  HomeTodoPlan,
  PlanNeedingDecision,
} from "./types";

export type * from "./types";

/** A coach recap stays relevant on the homepage for three days. */
export const COACH_NOTE_FRESH_HOURS = 72;

const ENTITY_LINK = /\{\{(?:plan|activity):[^|}]+\|([^}]+)\}\}/g;
const MARKDOWN_LINK = /\[([^\]]+)\]\([^)]*\)/g;
const MARKDOWN_MARKS = /[*_`#>~]+/g;

const startOfLocalDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const sameLocalDay = (a: Date, b: Date) =>
  startOfLocalDay(a).getTime() === startOfLocalDay(b).getTime();

/** Plain text for a one-glance preview of a coach message. */
export function coachNoteText(content: string): string {
  return content
    .replace(ENTITY_LINK, "$1")
    .replace(MARKDOWN_LINK, "$1")
    .replace(MARKDOWN_MARKS, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The coach note shows only when the latest weekly recap is unread, recent,
 * and the person still wants proactive coaching. Otherwise nothing shows.
 */
export function pickHomeCoachNote({
  preview,
  planType,
  proactiveCoachingEnabled,
  now,
}: HomeCoachNoteInput): HomeCoachNote | null {
  if (!preview?.isUnread) return null;
  if (planType === "FREE" || proactiveCoachingEnabled === false) return null;
  const createdAt = new Date(preview.createdAt);
  const ageHours = (now.getTime() - createdAt.getTime()) / 3_600_000;
  if (ageHours < 0 || ageHours > COACH_NOTE_FRESH_HOURS) return null;
  const text = coachNoteText(preview.content);
  if (!text) return null;
  return { id: preview.id, text, createdAt };
}

/**
 * Plans past their end date, or scheduled plans with nothing left to do,
 * stay on the homepage until the person renews or archives them.
 */
export function plansNeedingDecision(
  plans: HomeTodoPlan[],
  now: Date,
): PlanNeedingDecision[] {
  const today = startOfLocalDay(now);
  return plans
    .filter((plan) => !plan.deletedAt && !plan.archivedAt)
    .flatMap((plan): PlanNeedingDecision[] => {
      const ended =
        !!plan.finishingDate && new Date(plan.finishingDate) < today;
      const unscheduled =
        plan.outlineType === "SPECIFIC" &&
        !(plan.sessions ?? []).some(
          (session) => startOfLocalDay(new Date(session.date)) >= today,
        );
      if (!ended && !unscheduled) return [];
      return [
        {
          planId: plan.id,
          goal: plan.goal,
          emoji: plan.emoji,
          reason: ended ? "ended" : "unscheduled",
        },
      ];
    });
}

/** True when at least one tracked metric has not been rated or skipped today. */
export function isDailyCheckinDue(
  metrics: HomeTodoMetric[],
  entries: HomeTodoMetricEntry[],
  now: Date,
): boolean {
  if (!metrics.length) return false;
  return metrics.some(
    (metric) =>
      !entries.some(
        (entry) =>
          entry.metricId === metric.id &&
          (entry.rating > 0 || !!entry.skipped) &&
          sameLocalDay(new Date(entry.createdAt), now),
      ),
  );
}
