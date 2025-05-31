import React, { useMemo } from "react";
import {
  ApiPlan,
  Activity,
  ActivityEntry,
  convertApiPlanToPlan,
} from "@/contexts/UserPlanContext";
import {
  subWeeks,
  startOfWeek,
  isAfter,
  format,
  addWeeks,
  isBefore,
  subDays,
  isSameWeek,
} from "date-fns";
import { useThemeColors } from "@/hooks/useThemeColors";
import { getThemeVariants } from "@/utils/theme";
import { Badge } from "./ui/badge";
import FireBadge from "./FireBadge";
import TrophyBadge from "./FireBadge";
import { Collapsible, CollapsibleContent } from "./ui/collapsible";
import {
  ACHIEVEMENT_WEEKS,
  calculatePlanAchievement,
} from "@/contexts/PlanProgressContext/lib";
import { usePlanProgress } from "@/contexts/PlanProgressContext";

interface PlansAchievementsProps {
  plans: ApiPlan[];
  activities: Activity[];
  activityEntries: ActivityEntry[];
  timeRangeDays?: number;
  className?: string;
  onClick?: () => void;
  isExpanded?: boolean;
}

const PlansAchievements: React.FC<PlansAchievementsProps> = ({
  plans,
  activities,
  activityEntries,
  timeRangeDays = 60,
  className = "",
  onClick,
  isExpanded = true, // Default to true for backward compatibility
}) => {
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);
  const { plansProgress } = usePlanProgress();

  // Helper function to check if a streak was achieved this week
  const wasStreakAchievedThisWeek = (planProgressData: any) => {
    const currentWeek = planProgressData.weeks?.find((week: any) =>
      isSameWeek(week.startDate, new Date())
    );

    if (!currentWeek || !currentWeek.completedActivities?.length) {
      return false;
    }

    // Check if this week has completed activities and the streak is > 0
    return (
      planProgressData.achievement.streak > 0 &&
      currentWeek.completedActivities.length > 0
    );
  };

  return (
    <div className={`flex flex-col gap-3 ${className} w-full`}>
      <Collapsible open={isExpanded}>
        {/* All badges row - always visible */}
        <div className="flex flex-wrap gap-3">
          {plansProgress.map((planProgressData) => {
            const { plan, achievement } = planProgressData;
            const isNewThisWeek = wasStreakAchievedThisWeek(planProgressData);

            return (
              <div
                key={plan.id}
                className="flex items-center gap-2"
                onClick={onClick}
              >
                <div
                  className={`overflow-visible transition-all duration-300 ${
                    isExpanded ? "h-[60px] w-[60px] mb-6" : "h-[50px] w-[50px]"
                  } overflow-hidden relative `}
                >
                  <div
                    className={`transition-all duration-300 ${
                      isExpanded ? "scale-100" : "scale-80"
                    }`}
                  >
                    <FireBadge>
                      x{achievement.streak}{" "}
                      <span className="opacity-100 ml-1">{plan.emoji}</span>
                    </FireBadge>
                  </div>

                  {/* New pill absolutely positioned below the fire badge */}
                  {isNewThisWeek && achievement.streak > 0 && (
                    <div
                      className={`absolute -bottom-6 left-1/2 transform -translate-x-1/2 ${
                        variants.card.selected.glassBg
                      } ${
                        variants.darkText
                      } text-[10px] px-2 py-0.5 rounded-full font-medium shadow-sm transition-all duration-300 ${
                        isExpanded ? "opacity-100" : "opacity-0"
                      } whitespace-nowrap`}
                    >
                      +1 New
                    </div>
                  )}
                </div>

                {achievement.isAchieved && (
                  <div
                    className={`transition-all duration-300 ${
                      isExpanded
                        ? "opacity-100 h-[60px] w-[60px] max-w-full"
                        : "opacity-0 h-[55px] w-[55px] max-w-0 overflow-hidden"
                    } relative`}
                  >
                    <div
                      className={`transition-all duration-300 ${
                        isExpanded ? "scale-100" : "scale-80"
                      }`}
                    >
                      <TrophyBadge>
                        <span className="opacity-100 ml-1">{plan.emoji}</span>
                      </TrophyBadge>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Progress bars - smoothly animate in/out */}
        <CollapsibleContent>
          <div className="flex flex-col gap-2 mt-4 px-2 w-full">
            {plansProgress
              .filter(({ achievement }) => !achievement.isAchieved)
              .map(({ plan, achievement }) => {
                // Calculate progress percentage from completed weeks and total weeks
                const progressPercentage =
                  achievement.totalWeeks > 0
                    ? Math.min(
                        100,
                        (achievement.completedWeeks / ACHIEVEMENT_WEEKS) * 100
                      ) // 12 weeks = 100%
                    : 0;

                return (
                  <div
                    key={plan.id}
                    className="w-full flex flex-col justify-center gap-1"
                  >
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${variants.bg}`}
                        style={{ width: `${progressPercentage}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-600">
                      {achievement.weeksToAchieve} weeks to achieve{" "}
                      <span className="text-lg">{plan.emoji}</span> lifestyle
                      badge!
                    </p>
                  </div>
                );
              })}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default PlansAchievements;
