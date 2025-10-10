import { usePlans } from "@/contexts/plans";
import { usePaidPlan } from "@/hooks/usePaidPlan";
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
  const { userPlanType: userPaidPlanType } = usePaidPlan();
  const { plans, isLoadingPlans } = usePlans();
  const activePlans = plans?.filter(p => !p.deletedAt) ?? [];

  if (isLoadingPlans || !plans) {
    return <div className={cn("w-full flex flex-col gap-4", className)}>Loading...</div>;
  }

  return (
    <div className={cn("w-full flex flex-col gap-4", className)}>
      {/* Progress bars section */}
      {activePlans.filter(Boolean).map((plan, index: number) => {
        const { progress } = plan;
        const { weeks, achievement } = progress;

        const shouldShow = index == 0 || isExpanded;
        const isCoached = index == 0 && userPaidPlanType != "FREE";

        return (
          <PlanProgressCard
            key={plan.id}
            plan={plan}
            weeks={weeks}
            achievement={achievement}
            isCoached={isCoached}
            isExpanded={shouldShow}
          />
        );
      })}
    </div>
  );
};
