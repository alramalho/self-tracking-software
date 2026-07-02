import type { PlanState } from "@tsw/prisma";
import { buildPlanWeekProjection } from "@tsw/prisma/plan-week";
import type { CompletePlan } from "@/contexts/plans";
import type { CalendarActivity, CalendarSession } from "@/components/CalendarGrid";

export type GhostCellKind = "ghost" | "overflow" | "completed";

export interface CompletedEntry {
  activityId: string | null;
  datetime: Date | string;
}

export interface GhostCell {
  date: Date;
  activityId: string;
  planId: string;
  title?: string;
  emoji?: string | null;
  kind: GhostCellKind;
  state: PlanState | null;
}

export interface GridData {
  /** SPECIFIC plans' real sessions — flow through CalendarGrid's `sessions` prop. */
  scheduledSessions: CalendarSession[];
  /** TIMES_PER_WEEK ghosts + overflow — flow through CalendarGrid's `ghostCells` prop. */
  ghostCells: GhostCell[];
  /** Union of activities across all plans, for emoji/title lookup. */
  activities: CalendarActivity[];
}

/** Active, visible (non-archived, non-paused, not finished) plan. */
export function isActiveVisiblePlan(plan: CompletePlan): boolean {
  return Boolean(
    !plan.deletedAt &&
      !plan.archivedAt &&
      !plan.isPaused &&
      (!plan.finishingDate || new Date(plan.finishingDate) > new Date())
  );
}

/**
 * Build the 2-week grid view across all active plans. Pure & client-side.
 *
 * - SPECIFIC plans contribute their real dated sessions (scheduled).
 * - TIMES_PER_WEEK plans contribute plan-level ghost cells spread across the
 *   remaining open days. This week's count uses the lower of server-computed
 *   remaining days and fresh local completions, so a just-logged activity does
 *   not leave a stale placeholder behind. Next week's count is the full
 *   `timesPerWeek`. When more ghosts are needed than open days remain, the
 *   surplus renders as `overflow` — which is exactly the condition the backend
 *   reports as `FAILED`.
 */
export function computeGridCells(
  plans: CompletePlan[] | undefined,
  today: Date,
  completedEntries: CompletedEntry[] = []
): GridData {
  const projection = buildPlanWeekProjection({
    plans: (plans ?? []).filter(isActiveVisiblePlan),
    entries: completedEntries,
    now: today,
    weekCount: 2,
  });

  const scheduledSessions: CalendarSession[] = projection.scheduledSessions.map(
    (session) => ({
      id: session.id,
      date: session.date,
      activityId: session.activityId,
      planId: session.planId,
      planTitle: session.planTitle,
      planEmoji: session.planEmoji ?? undefined,
      quantity: session.quantity ?? undefined,
      descriptiveGuide: session.descriptiveGuide ?? undefined,
      imageUrls: session.imageUrls ?? undefined,
    })
  );

  const ghostCells: GhostCell[] = [
    ...projection.flexibleCells.map((cell) => ({
      date: cell.date,
      activityId: cell.activityId,
      planId: cell.planId,
      title: cell.title,
      emoji: cell.emoji,
      kind: cell.kind,
      state: (cell.state as PlanState | null) ?? null,
    })),
    ...projection.completedCells.map((cell) => ({
      date: cell.date,
      activityId: cell.activityId,
      planId: cell.planId,
      title: cell.title,
      emoji: cell.emoji,
      kind: "completed" as const,
      state: null,
    })),
  ];

  return {
    scheduledSessions,
    ghostCells,
    activities: projection.activities.map((activity) => ({
      id: activity.id,
      title: activity.title,
      emoji: activity.emoji ?? undefined,
      measure: activity.measure ?? undefined,
    })),
  };
}
