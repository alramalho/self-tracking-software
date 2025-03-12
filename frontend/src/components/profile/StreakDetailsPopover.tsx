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
} from "date-fns";
import {
  convertApiPlanToPlan,
  useUserPlan,
} from "@/contexts/UserPlanContext";
import { isWeekCompleted } from "@/components/PlanActivityEntriesRenderer";
import { TimeRange, getTimeRangeDays } from "@/app/profile/[username]/ProfilePage";

interface StreakDetailsPopoverProps {
  open: boolean;
  onClose: () => void;
  timeRange: TimeRange;
  onTimeRangeChange: (value: TimeRange) => void;
}

const StreakDetailsPopover: React.FC<StreakDetailsPopoverProps> = ({
  open,
  onClose,
  timeRange,
  onTimeRangeChange,
}) => {
  const { useCurrentUserDataQuery } = useUserPlan();
  const currentUserQuery = useCurrentUserDataQuery();
  const profileData = currentUserQuery.data;
  const { activityEntries, activities } = profileData || {
    activityEntries: [],
    activities: [],
  };

  return (
    <AppleLikePopover
      open={open}
      onClose={onClose}
      title="Streak Details"
    >
      <div className="p-4 space-y-6">
        <h3 className="text-xl font-semibold mb-4">
          🔥 Streak Breakdown
        </h3>

        <div className="space-y-4">
          {profileData?.plans?.map((plan) => {
            // Filter activities and entries for this plan
            const planActivities = activities.filter(
              (activity) =>
                plan.activity_ids?.includes(activity.id) ?? false
            );
            const planActivityEntries = activityEntries.filter(
              (entry) =>
                plan.activity_ids?.includes(entry.activity_id) ?? false
            );

            // Calculate score for this plan
            const now = new Date();
            const currentWeekStart = startOfWeek(now, {
              weekStartsOn: 0,
            });
            const daysToSubtract = getTimeRangeDays(timeRange);
            const rangeStartDate = subDays(now, daysToSubtract);

            let weekStart = startOfWeek(rangeStartDate, {
              weekStartsOn: 0,
            });
            let planScore = 0;
            let completedWeeks = 0;
            let incompleteWeeks = 0;

            while (weekStart < currentWeekStart) {
              const convertedPlan = convertApiPlanToPlan(
                plan,
                planActivities
              );
              const wasCompleted = isWeekCompleted(
                weekStart,
                convertedPlan,
                planActivityEntries
              );

              if (wasCompleted) {
                planScore += 1;
                completedWeeks += 1;
                // Reset buffer when a week is completed
                incompleteWeeks = 0;
              } else {
                incompleteWeeks += 1;
                // Only decrease score if we've missed more than one week (buffer week)
                if (incompleteWeeks > 1) {
                  planScore = Math.max(0, planScore - 1);
                }
              }

              weekStart = new Date(
                weekStart.getTime() + 7 * 24 * 60 * 60 * 1000
              );
            }

            if (
              planScore === 0 &&
              completedWeeks === 0 &&
              incompleteWeeks === 0
            ) {
              return null;
            }

            return (
              <div
                key={plan.id}
                className="p-4 border rounded-lg bg-white/50"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">{plan.emoji}</span>
                  <h4 className="font-medium">{plan.goal}</h4>
                </div>
                <div className="space-y-2 text-sm text-gray-600">
                  <p>• Completed weeks: {completedWeeks}</p>
                  <p>• Incomplete weeks: {incompleteWeeks}</p>
                  <p>• Current streak score: {planScore}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-row gap-4 justify-between items-center">
          <span className="text-sm text-gray-500">Time range</span>
          <div className="flex self-center">
            <select
              className="p-2 border rounded-md font-medium text-gray-800"
              value={timeRange}
              onChange={(e) =>
                onTimeRangeChange(
                  e.target.value as TimeRange
                )
              }
            >
              <option value="60 Days">Since 60 days ago</option>
              <option value="120 Days">Since 120 days ago</option>
              <option value="180 Days">Since 180 days ago</option>
            </select>
          </div>
        </div>

        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium mb-2">
            How streaks are calculated:
          </h4>
          <ul className="text-sm text-gray-600 space-y-2">
            <li>• Each completed week adds +1 to your streak</li>
            <li>• You have a 1-week buffer when you miss a week.</li>
            <li>
              • After the buffer week, each additional incomplete week
              subtracts -1 from your streak
            </li>
            <li>• Streak score cannot go below 0</li>
            <li>
              • Current week is not counted (as it is still in progress)
            </li>
          </ul>
          <br />
          <br />
          <p className="text-sm text-gray-600">
            The goal of the streaks is to motivate you to keep consistent!
            Without over-stressing or demotivating when you fail.
            <br />
            That&apos;s why you have a 1-week buffer when you miss a week
            :) We all have off weeks!
          </p>
        </div>
      </div>
    </AppleLikePopover>
  );
};

export default StreakDetailsPopover;
