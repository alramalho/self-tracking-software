import { usePlans } from "@/contexts/plans";
import { useCurrentUser } from "@/contexts/users";
import React from "react";

export const CollapsibleSelfUserCard: React.FC = () => {
  const { currentUser } = useCurrentUser();
  const { plans } = usePlans();

  if (!currentUser) {
    return null;
  }

  const firstPlan = plans?.reduce((min, plan) => {
    if (!plan.sortOrder && !min.sortOrder) return min;
    if (!plan.sortOrder) return min;
    if (!min.sortOrder) return plan;
    return plan.sortOrder < min.sortOrder ? plan : min;
  }, plans[0]);

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Your profile</h2>
      <div className="grid grid-cols-1 justify-items-center">
        <div className="max-w-sm w-full bg-white rounded-2xl border border-gray-200">
          {/* Header with icons - Avatar + Plan Emoji */}
          <div className="flex items-center justify-between p-6 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-xl flex-shrink-0">
                {currentUser.picture ? (
                  <img
                    src={currentUser.picture}
                    alt={currentUser.username || ""}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  currentUser.name?.[0] || "U"
                )}
              </div>
              {firstPlan && <span className="text-4xl">{firstPlan.emoji}</span>}
            </div>
          </div>

          {/* Card content */}
          <div className="px-6 pb-6">
            <h3 className="text-xl font-semibold mb-1">{currentUser.name}</h3>

            {firstPlan && (
              <p className="text-sm text-gray-600">{firstPlan.goal}</p>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};