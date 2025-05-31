import React from "react";
import AppleLikePopover from "@/components/AppleLikePopover";
import {
  useUserPlan,
} from "@/contexts/UserPlanContext";
import { usePlanProgress } from "@/contexts/PlanProgressContext";

interface StreakDetailsPopoverProps {
  open: boolean;
  onClose: () => void;
}

const StreakDetailsPopover: React.FC<StreakDetailsPopoverProps> = ({
  open,
  onClose,
}) => {
  const { useCurrentUserDataQuery } = useUserPlan();
  const { plansProgress } = usePlanProgress();
  const currentUserQuery = useCurrentUserDataQuery();
  const profileData = currentUserQuery.data;
  const { activityEntries } = profileData || {
    activityEntries: [],
  };

  return (
    <AppleLikePopover open={open} onClose={onClose} title="Streak Details">
      <div className="p-4 space-y-6">
        <h3 className="text-xl font-semibold mb-4">🔥 Streak Breakdown</h3>

        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium mb-2">How streaks are calculated:</h4>
          <ul className="text-sm text-gray-600 space-y-2">
            <li>
              • Each completed week adds <span className="font-bold">+1</span>{" "}
              to your streak
            </li>
            <li>
              • Each incomplete week subtracts{" "}
              <span className="font-bold">-1</span> from your streak
            </li>
            <li>
              • You have a <span className="font-bold">1 week buffer</span>{" "}
              before it starts subtracting from your streak.
            </li>
            <li>
              • Streak score cannot go below{" "}
              <span className="font-bold">0</span>
            </li>
          </ul>
        </div>

        <div className="space-y-4">
          {profileData?.plans?.map((plan) => {
            const progressData = plansProgress.find(
              (p) => p.plan.id === plan.id
            );

            if (!progressData) {
              return null;
            }

            const { streak, completedWeeks, incompleteWeeks } =
              progressData.achievement;

            if (
              streak === 0 &&
              completedWeeks === 0 &&
              incompleteWeeks === 0 &&
              !activityEntries.some((entry) =>
                plan.activity_ids?.includes(entry.activity_id)
              )
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
                    <span className="font-bold">{streak}</span>
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
