import { isSameWeek, startOfDay, startOfWeek, subDays } from "date-fns";
import { completedDays, localDay, visibleSessions } from "@/features/follow-through/model";
import { streakProgress } from "@/features/plans/streak-progress";
import { metricDayKey } from "@/features/metrics/model";
import type { WidgetData, WidgetSnapshot } from "./types";

/** Only the small, displayable homepage summary crosses into the shared container. */
export function widgetSnapshot(data: WidgetData, now = new Date()): WidgetSnapshot {
  const plans = data.plans.filter(plan => !plan.deletedAt && !plan.archivedAt)
    .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999) ||
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return {
    version: 1,
    updatedAt: now.toISOString(),
    weekStart: localDay(startOfWeek(now, { weekStartsOn: 0 })),
    plans: plans.map(plan => {
      const week = plan.progress?.weeks?.find(week => isSameWeek(new Date(week.startDate), now));
      const achievement = streakProgress(plan.progress);
      const target = typeof week?.plannedActivities === "number" ? week.plannedActivities :
        Array.isArray(week?.plannedActivities) ? week.plannedActivities.length :
        plan.outlineType === "TIMES_PER_WEEK" ? plan.timesPerWeek :
        plan.sessions.filter(session => isSameWeek(new Date(session.date), now)).length;
      return {
        id: plan.id, title: plan.goal, emoji: plan.activities[0]?.emoji ?? plan.emoji,
        completed: completedDays(plan, data.entries, now),
        target: Math.max(0, target), streak: achievement.streak,
        stage: achievement.stage, stageTarget: achievement.target,
        paused: !!plan.isPaused,
        ended: !!plan.finishingDate && new Date(plan.finishingDate) < startOfDay(now),
      };
    }),
    sessions: visibleSessions({ plans, state: data.followThrough?.state, now })
      .filter(session => session.outcome === "UNCONFIRMED" && session.date >= localDay(now))
      .slice(0, 40).map(session => {
        const plan = plans.find(plan => plan.id === session.planId)!;
        return {
          id: session.id, planId: plan.id, title: plan.goal, emoji: plan.emoji,
          date: session.date, time: session.time, timezone: session.timezone,
          durationMinutes: session.durationMinutes,
        };
      }),
    metrics: data.metrics.map(metric => ({
      id: metric.id, title: metric.title, emoji: metric.emoji,
      loggedDays: [...new Set(data.metricEntries.filter(entry =>
        entry.metricId === metric.id && (entry.skipped || entry.rating > 0) &&
        metricDayKey(entry.createdAt) >= localDay(subDays(now, 7)) &&
        metricDayKey(entry.createdAt) <= localDay(now),
      ).map(entry => metricDayKey(entry.createdAt)))].sort(),
    })),
  };
}
