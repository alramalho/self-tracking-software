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
} from "date-fns";
import { isWeekCompleted } from "@/components/PlanActivityEntriesRenderer";
import { useThemeColors } from "@/hooks/useThemeColors";
import { getThemeVariants } from "@/utils/theme";
import { Badge } from "./ui/badge";
import FireBadge from "./FireBadge";
import { calculatePlanAchievement } from "./profile/StreakDetailsPopover";
import TrophyBadge from "./FireBadge";
import { Collapsible, CollapsibleContent } from "./ui/collapsible";

interface PlansAchievementsProps {
  plans: ApiPlan[];
  activities: Activity[];
  activityEntries: ActivityEntry[];
  timeRangeDays?: number;
  className?: string;
  onClick?: () => void;
  isExpanded?: boolean;
}

export const ACHIEVEMENT_THRESHOLD = 0.8; // 80% completion required
export const ACHIEVEMENT_WEEKS = 12; // Last 12 weeks for achievement calculation
export const LIFESTYLE_START_COUNTING_DATE = subDays(
  new Date(),
  ACHIEVEMENT_WEEKS * 7
);

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

  // Calculate streaks and achievements for all plans
  const plansData = useMemo(() => {
    return plans.map((plan) => {
      // Calculate streak
      const {
        planScore,
        completedWeeks,
        isAchieved,
      } = calculatePlanAchievement(
        plan,
        activities,
        activityEntries,
        ACHIEVEMENT_THRESHOLD,
        LIFESTYLE_START_COUNTING_DATE
      );
      return {
        plan,
        streak: planScore,
        achievement: {
          completedWeeks,
          isAchieved,
          weeksToAchieve: Math.max(0, ACHIEVEMENT_WEEKS - completedWeeks),
          progress: (completedWeeks / ACHIEVEMENT_WEEKS) * 100,
        },
      };
    });
  }, [plans, activities, activityEntries, timeRangeDays]);

  return (
    <div className={`flex flex-col gap-3 ${className} w-full`}>
      <Collapsible open={isExpanded}>
        {/* All badges row - always visible */}
        <div className="flex flex-wrap gap-3">
          {plansData.map(({ plan, streak, achievement }) => (
            <div
              key={plan.id}
              className="flex items-center gap-2"
              onClick={onClick}
            >
              <div className={`overflow-visible transition-all duration-300 ${
                isExpanded ? 'h-[60px] w-[60px]' : 'h-[50px] w-[50px]'
              } overflow-hidden relative`}>
                <div className={`transition-all duration-300 ${
                  isExpanded ? 'scale-100' : 'scale-80'
                }`}>
                  <FireBadge>
                    x{streak} <span className="opacity-100 ml-1">{plan.emoji}</span>
                  </FireBadge>
                </div>
              </div>

              {achievement.isAchieved && (
                <div className={`transition-all duration-300 ${
                  isExpanded 
                    ? 'opacity-100 h-[60px] w-[60px] max-w-full' 
                    : 'opacity-0 h-[55px] w-[55px] max-w-0 overflow-hidden'
                } relative`}>
                  <div className={`transition-all duration-300 ${
                    isExpanded ? 'scale-100' : 'scale-80'
                  }`}>
                    <TrophyBadge>
                      <span className="opacity-100 ml-1">{plan.emoji}</span>
                    </TrophyBadge>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Progress bars - smoothly animate in/out */}
        <CollapsibleContent>
          <div className="flex flex-col gap-2 mt-4 px-2 w-full">
            {plansData
              .filter(({ achievement }) => !achievement.isAchieved)
              .map(({ plan, achievement }) => (
                <div
                  key={plan.id}
                  className="w-full flex flex-col justify-center gap-1"
                >
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${variants.bg}`}
                      style={{ width: `${achievement.progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-600">
                    {achievement.weeksToAchieve} weeks to achieve{" "}
                    <span className="text-lg">{plan.emoji}</span> lifestyle badge!
                  </p>
                </div>
              ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default PlansAchievements;
