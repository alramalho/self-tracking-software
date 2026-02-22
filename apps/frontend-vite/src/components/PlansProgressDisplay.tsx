import { usePlans } from "@/contexts/plans";
import { cn } from "@/lib/utils";
import React from "react";
import { PlanProgressCard } from "./PlanProgressCard";

interface PlansProgressDisplayProps {
  isExpanded: boolean;
  className?: string;
}

export const PlansProgressDisplay: React.FC<PlansProgressDisplayProps> = ({
  isExpanded,
  className,
}) => {
  const { plans, isLoadingPlans } = usePlans();
  const activePlans = plans?.filter(p => !p.deletedAt) ?? [];

  const sortedPlans = activePlans;

  if (isLoadingPlans || !plans) {
    return <div className={cn("w-full flex flex-col gap-4", className)}>Loading...</div>;
  }

  return (
    <div className={cn("w-full flex flex-col", isExpanded ? "gap-4" : "gap-0", className)}>
      {/* Progress bars section */}
      {sortedPlans
        .filter(Boolean)
        .map((plan, index: number) => {
          const { progress } = plan;
          const { weeks, achievement } = progress;

          const shouldShow = index === 0 || isExpanded;

          return (
            <PlanProgressCard
              key={plan.id}
              plan={plan}
              weeks={weeks}
              achievement={achievement}
              isExpanded={shouldShow}
            />
          );
        })}
    </div>
  );
};
