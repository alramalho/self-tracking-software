import { addDays, format, isBefore, startOfDay, startOfWeek } from "date-fns";
import type { PlanState } from "@tsw/prisma";
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
 * Pick `n` evenly-spread indices in `[0, m-1]`. Deterministic for a given (n, m).
 * Distinct when `n <= m`.
 */
function evenSpreadIndices(n: number, m: number): number[] {
  const indices: number[] = [];
  for (let i = 0; i < n; i++) {
    indices.push(Math.min(m - 1, Math.floor(((i + 0.5) * m) / n)));
  }
  return indices;
}

function placeGhosts(
  openDays: Date[],
  count: number,
  base: Omit<GhostCell, "date" | "kind">,
  out: GhostCell[]
): void {
  const m = openDays.length;
  if (count <= 0 || m === 0) return;

  if (count <= m) {
    for (const idx of evenSpreadIndices(count, m)) {
      out.push({ ...base, date: openDays[idx], kind: "ghost" });
    }
    return;
  }

  // count > m: every open day gets a ghost, the surplus stacks on the last day.
  for (const day of openDays) {
    out.push({ ...base, date: day, kind: "ghost" });
  }
  for (let i = 0; i < count - m; i++) {
    out.push({ ...base, date: openDays[m - 1], kind: "overflow" });
  }
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
  const weekStart = startOfWeek(today, { weekStartsOn: 0 });
  const windowEnd = addDays(weekStart, 14); // exclusive
  const todayStart = startOfDay(today);

  const week1Days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const week2Days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, 7 + i));
  const week1Open = week1Days.filter((d) => !isBefore(startOfDay(d), todayStart));

  const scheduledSessions: CalendarSession[] = [];
  const ghostCells: GhostCell[] = [];
  const activityMap = new Map<string, CalendarActivity>();
  const dayKey = (d: Date) => format(d, "yyyy-MM-dd");

  for (const plan of (plans ?? []).filter(isActiveVisiblePlan)) {
    for (const a of plan.activities ?? []) {
      if (!activityMap.has(a.id)) {
        activityMap.set(a.id, {
          id: a.id,
          title: a.title,
          emoji: a.emoji ?? undefined,
          measure: a.measure ?? undefined,
        });
      }
    }

    if (plan.outlineType === "SPECIFIC") {
      for (const s of plan.sessions ?? []) {
        const date = new Date(s.date);
        if (date >= weekStart && date < windowEnd) {
          scheduledSessions.push({
            id: s.id,
            date,
            activityId: s.activityId,
            quantity: s.quantity,
            descriptiveGuide: s.descriptiveGuide ?? undefined,
            imageUrls: s.imageUrls ?? undefined,
          });
        }
      }
      continue;
    }

    if (plan.outlineType === "TIMES_PER_WEEK") {
      const activityId = plan.activities?.[0]?.id;
      if (!activityId || !plan.timesPerWeek) continue;
      const planActivityIds = new Set(plan.activities?.map((a) => a.id) ?? []);
      const completedDaysThisWeek = new Set(
        completedEntries
          .filter((entry) => {
            if (!entry.activityId || !planActivityIds.has(entry.activityId)) return false;
            const date = new Date(entry.datetime);
            return date >= weekStart && date < addDays(weekStart, 7);
          })
          .map((entry) => dayKey(new Date(entry.datetime)))
      );
      const week1OpenForPlan = week1Open.filter(
        (day) => !completedDaysThisWeek.has(dayKey(day))
      );

      const base = {
        activityId,
        planId: plan.id,
        title: plan.goal,
        emoji: plan.emoji,
        state: plan.currentWeekState ?? null,
      };

      const stats = plan.progress?.currentWeekStats;
      const localWeek1Count = Math.max(
        0,
        plan.timesPerWeek - completedDaysThisWeek.size
      );
      const week1Count =
        stats?.numActiveDaysLeftInTheWeek == null
          ? localWeek1Count
          : Math.min(stats.numActiveDaysLeftInTheWeek, localWeek1Count);

      placeGhosts(week1OpenForPlan, week1Count, base, ghostCells);
      placeGhosts(week2Days, plan.timesPerWeek, base, ghostCells);
    }
  }

  // Completed activity logs — show what was actually done. Skip days that already
  // have a scheduled session for that activity (those render their own check).
  const scheduledKeys = new Set(
    scheduledSessions.map((s) => `${s.activityId}|${dayKey(new Date(s.date))}`)
  );
  const completedKeys = new Set<string>();
  for (const entry of completedEntries) {
    if (!entry.activityId) continue;
    const date = new Date(entry.datetime);
    if (date < weekStart || date >= windowEnd) continue;
    if (!activityMap.has(entry.activityId)) continue;
    const key = `${entry.activityId}|${dayKey(date)}`;
    if (scheduledKeys.has(key) || completedKeys.has(key)) continue;
    completedKeys.add(key);
    ghostCells.push({
      date,
      activityId: entry.activityId,
      planId: "completed",
      kind: "completed",
      state: null,
    });
  }

  return {
    scheduledSessions,
    ghostCells,
    activities: Array.from(activityMap.values()),
  };
}
