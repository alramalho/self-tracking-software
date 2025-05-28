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
} from "date-fns";
import { isWeekCompleted } from "@/components/PlanActivityEntriesRenderer";
import { useThemeColors } from "@/hooks/useThemeColors";
import { getThemeVariants } from "@/utils/theme";
import { Badge } from "./ui/badge";

interface PlansAchievementsProps {
  plans: ApiPlan[];
  activities: Activity[];
  activityEntries: ActivityEntry[];
  timeRangeDays?: number;
  className?: string;
  onClick?: () => void;
}

const ACHIEVEMENT_THRESHOLD = 0.8; // 80% completion required
const ACHIEVEMENT_WEEKS = 12; // Last 12 weeks for achievement calculation

const PlansAchievements: React.FC<PlansAchievementsProps> = ({
  plans,
  activities,
  activityEntries,
  timeRangeDays = 60,
  className = "",
  onClick,
}) => {
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);

  // Calculate streaks and achievements for all plans
  const plansData = useMemo(() => {
    return plans.map(plan => {
      // Calculate streak
      const planActivities = activities.filter(
        (activity) => plan.activity_ids?.includes(activity.id) ?? false
      );
      const planActivityEntries = activityEntries.filter(
        (entry) => plan.activity_ids?.includes(entry.activity_id) ?? false
      );

      const now = new Date();
      const currentWeekStart = startOfWeek(now, { weekStartsOn: 0 });
      const rangeStartDate = subWeeks(now, Math.floor(timeRangeDays / 7));

      let weekStart = startOfWeek(rangeStartDate, { weekStartsOn: 0 });
      let streak = 0;

      while (isBefore(weekStart, currentWeekStart)) {
        const convertedPlan = convertApiPlanToPlan(plan, planActivities);
        const wasCompleted = isWeekCompleted(
          weekStart,
          convertedPlan,
          planActivityEntries
        );

        if (wasCompleted) {
          streak += 1;
        }

        weekStart = addWeeks(weekStart, 1);
        if (
          format(weekStart, "yyyy-MM-dd") === format(currentWeekStart, "yyyy-MM-dd")
        ) {
          break;
        }
      }

      // Calculate achievement
      weekStart = startOfWeek(
        subWeeks(now, ACHIEVEMENT_WEEKS - 1),
        { weekStartsOn: 0 }
      );
      let completedWeeks = 0;

      while (isBefore(weekStart, currentWeekStart)) {
        const convertedPlan = convertApiPlanToPlan(plan, planActivities);
        const wasCompleted = isWeekCompleted(
          weekStart,
          convertedPlan,
          planActivityEntries
        );

        if (wasCompleted) {
          completedWeeks++;
        }

        weekStart = addWeeks(weekStart, 1);
        if (
          format(weekStart, "yyyy-MM-dd") === format(currentWeekStart, "yyyy-MM-dd")
        ) {
          break;
        }
      }

      const achievementRatio = completedWeeks / ACHIEVEMENT_WEEKS;
      const isAchieved = achievementRatio >= ACHIEVEMENT_THRESHOLD;
      const weeksToAchieve =
        Math.ceil(ACHIEVEMENT_WEEKS * ACHIEVEMENT_THRESHOLD) - completedWeeks;

      return {
        plan,
        streak,
        achievement: {
          completedWeeks,
          isAchieved,
          weeksToAchieve: Math.max(0, weeksToAchieve),
          progress: (completedWeeks / ACHIEVEMENT_WEEKS) * 100,
        }
      };
    });
  }, [plans, activities, activityEntries, timeRangeDays]);

  return (
    <div className={`flex flex-col gap-3 ${className} w-full`}>
      {/* All badges row */}
      <div className="flex flex-wrap gap-3">
        {plansData.map(({ plan, streak, achievement }) => (
          <div key={plan.id} className="flex items-center gap-2" onClick={onClick}>
            {/* Streak Badge (Fire) */}
            <div className={`relative ${streak === 0 ? "opacity-40 grayscale" : ""}`}>
              <picture>
                <source
                  srcSet="https://fonts.gstatic.com/s/e/notoemoji/latest/1f525/512.webp"
                  type="image/webp"
                />
                <img
                  src="https://fonts.gstatic.com/s/e/notoemoji/latest/1f525/512.gif"
                  alt="🔥"
                  width="60"
                  height="60"
                />
              </picture>
              <Badge className="absolute -bottom-2 -right-2 text-sm bg-black/60">
                x{streak} <span className="opacity-100 ml-1">{plan.emoji}</span>
              </Badge>
            </div>

            {/* Star Badge (if achieved) */}
            {achievement.isAchieved && (
              <div className="relative">
                <picture>
                  <source
                    srcSet="https://fonts.gstatic.com/s/e/notoemoji/latest/1f31f/512.webp"
                    type="image/webp"
                  />
                  <img
                    src="https://fonts.gstatic.com/s/e/notoemoji/latest/1f31f/512.gif"
                    alt="🌟"
                    width="60"
                    height="60"
                  />
                </picture>
                <Badge className="absolute -bottom-2 -right-2 text-2xl bg-transparent">
                  <span className="opacity-100 ml-1">{plan.emoji}</span>
                </Badge>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 mt-4 px-2 w-full">
        {plansData
          .filter(({ achievement }) => !achievement.isAchieved)
          .map(({ plan, achievement }) => (
            <div key={plan.id} className="w-full flex flex-col justify-center gap-1">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${variants.bg}`}
                  style={{ width: `${achievement.progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-600">
                {achievement.weeksToAchieve}{" "}
                {achievement.weeksToAchieve === 1 ? "week" : "weeks"} till <span className="text-lg">{plan.emoji}</span> lifestyle
                badge!
              </p>
            </div>
          ))}
      </div>
    </div>
  );
};

export default PlansAchievements; 