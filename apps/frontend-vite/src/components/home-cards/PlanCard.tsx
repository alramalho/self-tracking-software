import { type CompletePlan } from "@/contexts/plans";
import { SteppedBarProgress } from "@/components/SteppedBarProgress";
import { useNavigate } from "@tanstack/react-router";
import { format, isSameWeek } from "date-fns";
import type { PlanProgressData } from "@tsw/prisma/types";
import { Flame, Sprout, Rocket } from "lucide-react";
import { HomeCardShell } from "./HomeCardShell";

const HABIT_WEEKS = 4;
const LIFESTYLE_WEEKS = 9;

interface PlanCardProps {
  plan: CompletePlan & { progress: PlanProgressData };
}

export const PlanCard = ({ plan }: PlanCardProps) => {
  const navigate = useNavigate();

  const { weeks, achievement } = plan.progress;

  const currentWeek = weeks?.find((week) =>
    isSameWeek(week.startDate, new Date())
  );

  const totalPlanned =
    plan.outlineType === "TIMES_PER_WEEK"
      ? (currentWeek?.plannedActivities as number) || 0
      : ((currentWeek?.plannedActivities as any[])?.length || 0);

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

  return (
    <HomeCardShell onClick={() => navigate({ to: `/plans?selectedPlan=${plan.id}` })}>
      <div>
        <span className="text-2xl">{emoji}</span>
        <p className="text-sm font-medium text-foreground line-clamp-2 mt-1">
          {plan.goal}
        </p>
      </div>
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
    </HomeCardShell>
  );
};
