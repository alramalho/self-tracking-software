import { type CompletePlan } from "@/contexts/plans";
import { SteppedBarProgress } from "@/components/SteppedBarProgress";
import { useNavigate } from "@tanstack/react-router";
import {
  format,
  isSameWeek,
  isAfter,
  startOfDay,
} from "date-fns";
import type { PlanProgressData } from "@tsw/prisma/types";
import { CalendarDays, Flame, Sprout, Rocket } from "lucide-react";
import { HomeCardShell } from "./HomeCardShell";

const HABIT_WEEKS = 4;
const LIFESTYLE_WEEKS = 9;

interface PlanCardProps {
  plan: CompletePlan & { progress: PlanProgressData };
}

const getPlannedActivityCount = (
  plannedActivities: number | any[] | undefined,
  outlineType: CompletePlan["outlineType"]
) => {
  if (outlineType === "TIMES_PER_WEEK") {
    return typeof plannedActivities === "number" ? plannedActivities : 0;
  }

  return Array.isArray(plannedActivities) ? plannedActivities.length : 0;
};

export const PlanCard = ({ plan }: PlanCardProps) => {
  const navigate = useNavigate();

  const { weeks, achievement } = plan.progress;

  const currentWeek = weeks?.find((week) =>
    isSameWeek(week.startDate, new Date())
  );

  const progressPlanned = getPlannedActivityCount(
    currentWeek?.plannedActivities,
    plan.outlineType
  );
  const planTarget =
    plan.outlineType === "TIMES_PER_WEEK" ? (plan.timesPerWeek ?? 0) : 0;
  const totalPlanned = progressPlanned || planTarget;

  const uniqueDays = new Set(
    (currentWeek?.completedActivities || []).map((entry: any) =>
      format(new Date(entry.datetime || entry.date), "yyyy-MM-dd")
    )
  );
  const totalCompleted = uniqueDays.size;

  const habitProgress = plan.progress?.habitAchievement?.progressValue ?? Math.min(HABIT_WEEKS, achievement.streak);
  const habitMax = plan.progress?.habitAchievement?.maxValue ?? HABIT_WEEKS;
  const habitAchieved = plan.progress?.habitAchievement?.isAchieved || achievement.streak >= HABIT_WEEKS;

  const lifestyleProgress = plan.progress?.lifestyleAchievement?.progressValue ?? Math.min(LIFESTYLE_WEEKS, achievement.streak);
  const lifestyleMax = plan.progress?.lifestyleAchievement?.maxValue ?? LIFESTYLE_WEEKS;

  const emoji = plan.activities?.[0]?.emoji || plan.emoji || "🎯";
  const isSpecificPlan = plan.outlineType === "SPECIFIC";

  return (
    <HomeCardShell
      onClick={() => navigate({ to: `/plans?selectedPlan=${plan.id}` })}
      className="ring-0"
    >
      <div>
        <span className="text-2xl">{emoji}</span>
        <p className="text-sm font-medium text-foreground line-clamp-2 mt-1">
          {plan.goal}
        </p>
      </div>
      {isSpecificPlan ? (
        <div className="space-y-2">
          {(() => {
            const todayStart = startOfDay(new Date());
            const upcomingSessions = (plan.sessions || [])
              .filter((session) => !isAfter(todayStart, new Date(session.date)))
              .sort(
                (a, b) =>
                  new Date(a.date).getTime() - new Date(b.date).getTime()
              );
            const nextSession = upcomingSessions[0];
            const nextActivity = nextSession
              ? plan.activities?.find(
                  (activity) => activity.id === nextSession.activityId
                )
              : null;

            if (!nextSession || !nextActivity) {
              return (
                <div className="rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                  No sessions scheduled.
                </div>
              );
            }

            return (
              <div className="rounded-xl bg-muted/60 px-3 py-2">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5" />
                  <span>Next session</span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xl leading-none">
                    {nextActivity.emoji || "📋"}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">
                      {nextActivity.title}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {format(new Date(nextSession.date), "EEE, MMM d")}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      ) : (
        <div className="space-y-2.5">
          <SteppedBarProgress
            value={totalCompleted}
            maxValue={totalPlanned}
            goal={<Flame size={14} className="text-orange-400" />}
            compact
          />
          {!habitAchieved ? (
            <SteppedBarProgress
              value={habitProgress}
              maxValue={habitMax}
              goal={<Sprout size={14} className="text-lime-500" />}
              compact
              color="bg-lime-400"
            />
          ) : (
            <SteppedBarProgress
              value={lifestyleProgress}
              maxValue={lifestyleMax}
              goal={<Rocket size={14} className="text-amber-400" />}
              compact
              color="bg-amber-400"
            />
          )}
        </div>
      )}
    </HomeCardShell>
  );
};
