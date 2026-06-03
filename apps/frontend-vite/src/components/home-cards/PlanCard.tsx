import { type CompletePlan } from "@/contexts/plans";
import { SteppedBarProgress } from "@/components/SteppedBarProgress";
import { useNavigate } from "@tanstack/react-router";
import {
  differenceInCalendarDays,
  format,
  isSameWeek,
  startOfDay,
} from "date-fns";
import type { PlanProgressData } from "@tsw/prisma/types";
import { Flame, Sprout, Rocket } from "lucide-react";
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

const formatSessionDistance = (date: Date) => {
  const daysAway = differenceInCalendarDays(
    startOfDay(date),
    startOfDay(new Date())
  );

  if (daysAway <= 0) return "today";
  if (daysAway === 1) return "tomorrow";
  if (daysAway === 2) return "in 2 days";
  return `${format(date, "EEE")}, in ${daysAway} days`;
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
  const today = startOfDay(new Date());
  const nextSession =
    plan.outlineType === "SPECIFIC"
      ? plan.sessions
          ?.filter(
            (session) =>
              startOfDay(new Date(session.date)) >= today &&
              !currentWeek?.completedActivities?.some(
                (entry: any) =>
                  entry.activityId === session.activityId &&
                  format(new Date(entry.datetime || entry.date), "yyyy-MM-dd") ===
                    format(new Date(session.date), "yyyy-MM-dd")
              )
          )
          .sort(
            (a, b) =>
              new Date(a.date).getTime() - new Date(b.date).getTime()
          )[0]
      : null;
  const nextSessionActivity = nextSession
    ? plan.activities?.find((activity) => activity.id === nextSession.activityId)
    : null;
  const nextSessionTitle = nextSessionActivity?.title || "Next session";
  const nextSessionEmoji = nextSessionActivity?.emoji || emoji;

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
      <div className="space-y-2.5">
        {nextSession && (
          <div className="flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <span className="shrink-0 text-sm leading-none">{nextSessionEmoji}</span>
            <span className="min-w-0 truncate">{nextSessionTitle}</span>
            <span className="shrink-0 text-muted-foreground/70">
              ({formatSessionDistance(new Date(nextSession.date))})
            </span>
          </div>
        )}
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
    </HomeCardShell>
  );
};
