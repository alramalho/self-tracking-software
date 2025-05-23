import React, { useMemo } from "react";
import { 
  ApiPlan, 
  Activity, 
  ActivityEntry, 
  convertApiPlanToPlan 
} from "@/contexts/UserPlanContext";
import { Badge } from "@/components/ui/badge";
import { 
  subDays, 
  startOfWeek, 
  isAfter, 
  isBefore, 
  addWeeks, 
  format 
} from "date-fns";
import { isWeekCompleted } from "@/components/PlanActivityEntriesRenderer";

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
  className = "",
  onClick
}) => {
  const calculateStreak = useMemo((): { emoji: string; score: number } => {
    // Filter activities and entries for this plan
    const planActivities = activities.filter(
      (activity) => plan.activity_ids?.includes(activity.id) ?? false
    );
    const planActivityEntries = activityEntries.filter(
      (entry) => plan.activity_ids?.includes(entry.activity_id) ?? false
    );

    // Calculate date range based on timeRangeDays
    const now = new Date();
    const currentWeekStart = startOfWeek(now, { weekStartsOn: 0 });
    const rangeStartDate = subDays(now, timeRangeDays);

    // Start from the range start date or the earliest activity date, whichever is later
    let weekStart = startOfWeek(rangeStartDate, { weekStartsOn: 0 });

    if (planActivityEntries.length > 0) {
      const earliestActivityDate = new Date(
        Math.min(
          ...planActivityEntries.map((entry) =>
            new Date(entry.date).getTime()
          )
        )
      );

      if (isAfter(earliestActivityDate, weekStart)) {
        weekStart = startOfWeek(earliestActivityDate, { weekStartsOn: 0 });
      }
    }

    // Initialize plan score
    let planScore = 0;
    let weekCount = 0;
    let incompleteWeeks = 0;

    while (isBefore(weekStart, currentWeekStart)) {
      // Only check completed weeks
      weekCount++;
      const convertedPlan = convertApiPlanToPlan(plan, planActivities);

      // Only check weeks that fall within our time range
      if (
        isAfter(weekStart, rangeStartDate) ||
        format(weekStart, "yyyy-MM-dd") ===
          format(rangeStartDate, "yyyy-MM-dd")
      ) {
        const wasCompleted = isWeekCompleted(
          weekStart,
          convertedPlan,
          planActivityEntries
        );

        if (wasCompleted) {
          planScore += 1;
          incompleteWeeks = 0;
        } else {
          incompleteWeeks += 1;
          if (incompleteWeeks > 1) {
            planScore = Math.max(0, planScore - 1);
          }
        }
      }

      // Move to next week using date-fns addWeeks to handle DST correctly
      weekStart = addWeeks(weekStart, 1);
      if (
        format(weekStart, "yyyy-MM-dd") ===
        format(currentWeekStart, "yyyy-MM-dd")
      ) {
        break; // Stop if we've reached the current week
      }
    }

    return {
      emoji: plan.emoji || "💪",
      score: planScore,
    };
  }, [plan, activities, activityEntries, timeRangeDays]);

  const getSizeClasses = () => {
    switch (size) {
      case "small":
        return {
          container: "text-lg",
          image: { width: "50", height: "50" },
          badge: "text-xs"
        };
      case "medium":
        return {
          container: "text-xl",
          image: { width: "60", height: "60" },
          badge: "text-sm"
        };
      case "large":
        return {
          container: "text-2xl",
          image: { width: "70", height: "70" },
          badge: "text-sm"
        };
      default:
        return {
          container: "text-xl",
          image: { width: "50", height: "50" },
          badge: "text-sm"
        };
    }
  };

  const sizeClasses = getSizeClasses();
  const streak = calculateStreak;

  return (
    <div 
      className={`relative ${sizeClasses.container} font-bold flex items-center gap-1 min-w-fit min-h-fit ${onClick ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''} ${className}`} 
      onClick={onClick}
    >
      <div
        className={
          streak.score === 0 ? "opacity-40 grayscale" : ""
        }
      >
        <picture>
          <source
            srcSet="https://fonts.gstatic.com/s/e/notoemoji/latest/1f525/512.webp"
            type="image/webp"
          />
          <img
            src="https://fonts.gstatic.com/s/e/notoemoji/latest/1f525/512.gif"
            alt="🔥"
            width={sizeClasses.image.width}
            height={sizeClasses.image.height}
          />
        </picture>
        <Badge className={`absolute bottom-0 right-[-10px] ${sizeClasses.badge}`}>
          x{streak.score} {streak.emoji}
        </Badge>
      </div>
    </div>
  );
};

export default PlanStreak; 