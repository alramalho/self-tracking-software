import React from "react";
import AppleLikePopover from "@/components/AppleLikePopover";
import { Badge } from "@/components/ui/badge";
import {
  format,
  parseISO,
  subDays,
  startOfWeek,
  isAfter,
  isBefore,
  addWeeks,
  isSameDay,
  min,
} from "date-fns";
import {
  convertApiPlanToPlan,
  useUserPlan,
  Plan,
  Activity,
  ActivityEntry,
  ApiPlan,
} from "@/contexts/UserPlanContext";
import { isWeekCompleted } from "@/components/PlanActivityEntriesRenderer";

interface StreakDetailsPopoverProps {
  open: boolean;
  onClose: () => void;
}

export const calculatePlanAchievement = (
  plan: ApiPlan,
  activities: Activity[],
  activityEntries: ActivityEntry[],
  threshold: number,
  initialDate?: Date
) => {
  const planActivities = activities.filter(
    (activity) => plan.activity_ids?.includes(activity.id) ?? false
  );
  const planActivityEntries = activityEntries.filter(
    (entry) => plan.activity_ids?.includes(entry.activity_id) ?? false
  );

  if (planActivityEntries.length === 0) {
    return { planScore: 0, completedWeeks: 0, incompleteWeeks: 0, isAchieved: false, totalWeeks: 0 };
  }

  const firstEntryDate = initialDate
    ? initialDate
    : min(planActivityEntries.map((entry) => parseISO(entry.date)));

  const now = new Date();
  const currentWeekStart = startOfWeek(now, {
    weekStartsOn: 0,
  });

  let weekStart = startOfWeek(firstEntryDate, {
    weekStartsOn: 0,
  });

  let planScore = 0;
  let completedWeeks = 0;
  let incompleteWeeks = 0;
  let totalWeeks = 0;

  const convertedPlan = convertApiPlanToPlan(plan, planActivities);

  while (
    isAfter(currentWeekStart, weekStart) ||
    isSameDay(weekStart, currentWeekStart)
  ) {
    totalWeeks += 1;
    const isCurrentWeek = isSameDay(weekStart, currentWeekStart);
    const wasCompleted = isWeekCompleted(
      weekStart,
      convertedPlan,
      planActivityEntries
    );

    if (wasCompleted) {
      planScore += 1;
      completedWeeks += 1;
      if (!isCurrentWeek) {
        incompleteWeeks = 0;
      }
    } else if (!isCurrentWeek) {
      incompleteWeeks += 1;
      if (incompleteWeeks > 1) {
        planScore = Math.max(0, planScore - 1);
      }
    }

    weekStart = addWeeks(weekStart, 1);
  }

  const isAchieved = totalWeeks > 0 ? (completedWeeks / totalWeeks) >= threshold : false;

  return { planScore, completedWeeks, incompleteWeeks, isAchieved, totalWeeks };
};

const StreakDetailsPopover: React.FC<StreakDetailsPopoverProps> = ({
  open,
  onClose,
}) => {
  const { useCurrentUserDataQuery } = useUserPlan();
  const currentUserQuery = useCurrentUserDataQuery();
  const profileData = currentUserQuery.data;
  const { activityEntries, activities } = profileData || {
    activityEntries: [],
    activities: [],
  };

  return (
    <AppleLikePopover open={open} onClose={onClose} title="Streak Details">
      <div className="p-4 space-y-6">
        <h3 className="text-xl font-semibold mb-4">🔥 Streak Breakdown</h3>

        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium mb-2">How streaks are calculated:</h4>
          <ul className="text-sm text-gray-600 space-y-2">
            <li>• Each completed week adds <span className="font-bold">+1</span> to your streak</li>
            <li>• Each incomplete week subtracts <span className="font-bold">-1</span> from your streak</li>
            <li>
              • You have a <span className="font-bold">1 week buffer</span> before it starts subtracting from your
              streak.
            </li>
            <li>• Streak score cannot go below <span className="font-bold">0</span></li>
          </ul>
        </div>

        <div className="space-y-4">
          {profileData?.plans?.map((plan) => {
            const { planScore, completedWeeks, incompleteWeeks } =
              calculatePlanAchievement(
                plan,
                activities,
                activityEntries,
                // TODO: Determine a sensible default or pass a threshold value
                0.75 // Defaulting to 0.75, adjust as needed
              );

            if (
              planScore === 0 &&
              completedWeeks === 0 &&
              incompleteWeeks === 0 &&
              !activityEntries.some(entry => plan.activity_ids?.includes(entry.activity_id))
            ) {
              return null;
            }

            return (
              <div key={plan.id} className="p-4 border rounded-lg bg-white/50">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">{plan.emoji}</span>
                  <h4 className="font-medium">{plan.goal}</h4>
                </div>
                <div className="space-y-2 text-sm text-gray-600">
                  <p>
                    • Completed weeks:{" "}
                    <span className="font-bold">{completedWeeks}</span>
                  </p>
                  <p>
                    • Incomplete weeks since last streak:{" "}
                    <span className="font-bold">{incompleteWeeks}</span>
                  </p>
                  <p>
                    • Current streak score:{" "}
                    <span className="font-bold">{planScore}</span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppleLikePopover>
  );
};

export default StreakDetailsPopover;
