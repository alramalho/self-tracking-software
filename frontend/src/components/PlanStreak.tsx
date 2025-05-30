import React, { useMemo } from "react";
import {
  ApiPlan,
  Activity,
  ActivityEntry,
  convertApiPlanToPlan,
} from "@/contexts/UserPlanContext";
import { Badge } from "@/components/ui/badge";
import {
  subDays,
  startOfWeek,
  isAfter,
  isBefore,
  addWeeks,
  format,
  subWeeks,
} from "date-fns";
import { isWeekCompleted } from "@/components/PlanActivityEntriesRenderer";
import FireBadge from "./FireBadge";
import { ACHIEVEMENT_WEEKS } from "./PlansAchievements";
import { ACHIEVEMENT_THRESHOLD } from "./PlansAchievements";

interface PlanStreakProps {
  plan: ApiPlan;
  activities: Activity[];
  activityEntries: ActivityEntry[];
  timeRangeDays?: number;
  size?: "small" | "medium" | "large";
  className?: string;
  onClick?: () => void;
}

const PlanStreak: React.FC<PlanStreakProps> = ({
  plan,
  activities,
  activityEntries,
  timeRangeDays = 60,
  size = "medium",
  onClick,
}) => {
  const planData = useMemo(() => {
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
        format(weekStart, "yyyy-MM-dd") ===
        format(currentWeekStart, "yyyy-MM-dd")
      ) {
        break;
      }
    }

    // Calculate achievement
    weekStart = startOfWeek(subWeeks(now, ACHIEVEMENT_WEEKS - 1), {
      weekStartsOn: 0,
    });
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
        format(weekStart, "yyyy-MM-dd") ===
        format(currentWeekStart, "yyyy-MM-dd")
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
      },
    };
  }, [activities, activityEntries, plan, timeRangeDays]);

  return (
    <FireBadge onClick={onClick}>
      x{planData.streak}{" "}
      <span className="opacity-100 ml-1">{planData.plan.emoji}</span>
    </FireBadge>
    // <div
    //   className={`relative ${sizeClasses.container} font-bold flex items-center gap-1 min-w-fit min-h-fit ${onClick ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''} ${className}`}
    //   onClick={onClick}
    // >
    //   <div
    //     className={
    //       streak.score === 0 ? "opacity-40 grayscale" : ""
    //     }
    //   >
    //     <picture>
    //       <source
    //         srcSet="https://fonts.gstatic.com/s/e/notoemoji/latest/1f525/512.webp"
    //         type="image/webp"
    //       />
    //       <img
    //         src="https://fonts.gstatic.com/s/e/notoemoji/latest/1f525/512.gif"
    //         alt="🔥"
    //         width={sizeClasses.image.width}
    //         height={sizeClasses.image.height}
    //       />
    //     </picture>
    //     <Badge className={`absolute bottom-0 right-[-10px] ${sizeClasses.badge}`}>
    //       x{streak.score} {streak.emoji}
    //     </Badge>
    //   </div>
    // </div>
  );
};

export default PlanStreak;
