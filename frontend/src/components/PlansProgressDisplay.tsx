import React from "react";
import { isSameWeek, format } from "date-fns";
import { cn } from "@/lib/utils";
import { usePlanProgress } from "@/contexts/PlanProgressContext";
import FireBadge from "./FireBadge";
import { Collapsible, CollapsibleContent } from "./ui/collapsible";
import { usePaidPlan } from "@/hooks/usePaidPlan";
import { PlanProgressCard } from "./PlanProgressCard";



interface PlansProgressDisplayProps {
  isExpanded: boolean;
  className?: string;
}

export const PlansProgressDisplay: React.FC<PlansProgressDisplayProps> = ({
  isExpanded,
  className,
}) => {
  const { userPaidPlanType } = usePaidPlan();
  const { plansProgress } = usePlanProgress();

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

  return (
    <div className={cn("w-full flex flex-col gap-4", className)}>
      {/* Fire badges section */}
      <Collapsible open={isExpanded}>
        <CollapsibleContent className="space-y-0 ring-1 ring-gray-200 rounded-3xl overflow-hidden">
          <div className="flex flex-col gap-1 py-2 px-4 rounded-lg bg-white/60 backdrop-blur-sm">
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
      {plansProgress.map((planProgressData, index) => {
        const { plan, weeks, achievement } = planProgressData;

        const shouldShow = index == 0 || isExpanded;
        const isCoached = index == 0 && userPaidPlanType != "FREE";

        return (
          <PlanProgressCard
            key={plan.id}
            plan={plan}
            weeks={weeks}
            achievement={achievement}
            isCoached={isCoached}
            isExpanded={shouldShow}
          />
        );
      })}
    </div>
  );
};
