import { getPlanWeekDateKey } from "@tsw/prisma/plan-week";
import type { PlanWeekEntry, PlanWeekProjection } from "@tsw/prisma/plan-week";
import { addDay } from "@/features/onboarding/design/format";
import type { PlanDay } from "./types";

/**
 * The two calendar weeks the plan page shows, starting on this week's Sunday. `entries` are the
 * plan's own logs: the projection leaves scheduled days out of its completed cells, so a logged
 * session is marked here.
 */
export function planDays(projection: PlanWeekProjection, entries: PlanWeekEntry[] = []): PlanDay[][] {
  const logged = new Set(entries.map((entry) => getPlanWeekDateKey(entry.datetime)));
  return [0, 1].map((week) =>
    Array.from({ length: 7 }, (_, index) => {
      const key = addDay(projection.weekStartKey, week * 7 + index);
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
export function dayKind(day: PlanDay) {
  if (day.scheduled.length) return "scheduled" as const;
  if (day.done.length) return "done" as const;
  if (day.flexible.length) return "flexible" as const;
  return "rest" as const;
}
