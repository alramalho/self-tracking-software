import React, { useState } from "react";
import { isSameWeek, format } from "date-fns";
import { cn } from "@/lib/utils";
import { usePlanProgress } from "@/contexts/PlanProgressContext";
import {
  ACHIEVEMENT_WEEKS,
  isWeekCompleted as checkIsWeekCompleted,
} from "@/contexts/PlanProgressContext/lib";
import { SteppedBarProgress } from "./SteppedBarProgress";
import FireBadge from "./FireBadge";
import { Plan, PlanSession } from "@/contexts/UserPlanContext";
import { AnimatePresence } from "framer-motion";
import Confetti from "react-confetti-boom";
import { useThemeColors } from "@/hooks/useThemeColors";
import { getThemeVariants } from "@/utils/theme";
import { CircleCheck, Flame } from "lucide-react";
import { Medal } from "lucide-react";
import { Collapsible, CollapsibleContent } from "./ui/collapsible";

interface PlansProgressDisplayProps {
  plans: Plan[];
  isExpanded: boolean;
  className?: string;
}

export const PlansProgressDisplay: React.FC<PlansProgressDisplayProps> = ({
  plans,
  isExpanded,
  className,
}) => {
  const [canDisplayLifestyleAchieved, setCanDisplayLifestyleAchieved] =
    useState(false);
  const { plansProgress } = usePlanProgress();

  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);

  // Helper function to check if a streak was achieved this week
  const wasStreakAchievedThisWeek = (planProgressData: any) => {
    const currentWeek = planProgressData.weeks?.find((week: any) =>
      isSameWeek(week.startDate, new Date())
    );

    if (!currentWeek || !currentWeek.completedActivities?.length) {
      return false;
    }

    return (
      planProgressData.achievement.streak > 0 &&
      currentWeek.completedActivities.length > 0
    );
  };

  function getSessionId(session: PlanSession) {
    return `${session.date}-${session.activity_id}`;
  }

  function getSessionById(
    plan: Plan,
    sessionId: string
  ): PlanSession | undefined {
    return plan.sessions.find((session) => getSessionId(session) === sessionId);
  }

  return (
    <div className={cn("w-full flex flex-col", className)}>
      {/* Fire badges section */}
      <Collapsible open={isExpanded}>
        <CollapsibleContent className="space-y-0">
          <div className="flex flex-col gap-3 p-2 rounded-lg bg-gray-100/70">
            <span className="text-sm font-medium text-gray-700">Streaks</span>
            <div className="flex flex-wrap gap-3">
              {plansProgress.map((planProgressData) => {
                const { plan, achievement } = planProgressData;
                const isNewThisWeek =
                  wasStreakAchievedThisWeek(planProgressData);

                return (
                  <div key={plan.id} className="flex items-center gap-2">
                    <div
                      className={cn(
                        "overflow-visible transition-all duration-300 h-[50px] w-[50px] relative",
                        achievement.streak == 0 ? "grayscale opacity-50" : ""
                      )}
                    >
                      <div className="transition-all duration-300">
                        <FireBadge>
                          x{achievement.streak}{" "}
                          <span className="opacity-100 ml-1">
                            {plan.emoji || "📋"}
                          </span>
                        </FireBadge>
                      </div>

                      {/* New pill for streaks achieved this week */}
                      {isNewThisWeek && achievement.streak > 0 && (
                        <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 bg-white/80 text-gray-800 text-[10px] px-2 py-0.5 rounded-full font-medium shadow-sm whitespace-nowrap">
                          +1 New
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Progress bars section */}
      <div className="flex flex-col gap-0">
        {plansProgress.map((planProgressData, index) => {
          const { plan, weeks, achievement } = planProgressData;

          // Get current week data
          const currentWeek = weeks.find((week) =>
            isSameWeek(week.startDate, new Date())
          );

          if (!currentWeek) return null;

          // Calculate weekly progress
          const totalPlannedActivities =
            plan.outline_type === "times_per_week"
              ? (currentWeek.plannedActivities as number)
              : (currentWeek.plannedActivities as any[])?.length || 0;

          const uniqueDaysWithActivities = new Set(
            currentWeek.completedActivities.map((entry) =>
              format(new Date(entry.date), "yyyy-MM-dd")
            )
          );

          const totalCompletedActivities = uniqueDaysWithActivities.size;

          // Calculate lifestyle achievement progress
          const lifestyleProgressValue = Math.min(
            ACHIEVEMENT_WEEKS,
            achievement.streak
          );

          const isWeekCompleted = checkIsWeekCompleted(
            currentWeek.startDate,
            plan,
            currentWeek.completedActivities
          );
          const isCurrentWeek = isSameWeek(currentWeek.startDate, new Date());
          const showConfetti = isCurrentWeek && isWeekCompleted;

          const shouldShow = index == 0 || isExpanded;

          return (
            <Collapsible open={shouldShow}>
              <CollapsibleContent className="space-y-0">
                <div
                  key={plan.id}
                  className={`flex flex-col gap-4 p-2 rounded-lg transition-all duration-300 ${
                    achievement.isAchieved && canDisplayLifestyleAchieved
                      ? cn(
                          variants.verySoftGrandientBg,
                          variants.ringBright,
                          "ring-2 ring-offset-2 ring-offset-white"
                        )
                      : "bg-gray-100/60"
                  } from-gray-50`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{plan.emoji || "📋"}</span>
                      <div className="flex flex-col gap-1">
                        <span className="text-md font-semibold text-gray-800">
                          {plan.goal}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Current week progress with animated legend */}
                  <div>
                    <SteppedBarProgress
                      value={totalCompletedActivities}
                      maxValue={totalPlannedActivities}
                      goal={
                        <Flame size={19} className="text-orange-400 mb-1" />
                      }
                      onFullyDone={() => {
                        console.log("finished");
                      }}
                      className="w-full"
                      celebration={
                        <span className="flex items-center gap-1">
                          🎉
                          <span className="text-xs font-normal text-gray-500 animate-pulse">
                            Week completed
                          </span>
                        </span>
                      }
                    />

                    {/* Lifestyle achievement progress */}
                    <div className="space-y-1">
                      <SteppedBarProgress
                        value={lifestyleProgressValue}
                        maxValue={ACHIEVEMENT_WEEKS}
                        goal={<Medal size={19} className="text-amber-400" />}
                        className={cn("w-full")}
                        onFullyDone={() => {
                          setCanDisplayLifestyleAchieved(true);
                        }}
                        color={variants.bg}
                        celebration={
                          <span className="flex items-center gap-1">
                            <CircleCheck size={19} className="text-green-500" />
                            <span className="text-xs font-normal text-gray-500">
                              Part of your lifestyle!
                            </span>
                          </span>
                        }
                      />
                    </div>

                    {/* Confetti animation for completed weeks */}
                    <AnimatePresence>
                      {showConfetti && (
                        <div className="fixed top-1/2 left-0 w-screen h-screen pointer-events-none z-[101]">
                          <Confetti mode="boom" particleCount={150} />
                        </div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
};
