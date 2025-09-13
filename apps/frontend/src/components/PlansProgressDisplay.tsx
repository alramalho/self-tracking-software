import { usePlansProgress } from "@/contexts/PlansProgressContext";
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
  const { plans } = usePlans();
  const activePlans = plans?.filter(p => !p.deletedAt) ?? [];
  const planIds = activePlans.map(p => p.id);
  const { data: plansProgressData, isLoading } = usePlansProgress(planIds);

  if (isLoading || !plansProgressData) {
    return <div className={cn("w-full flex flex-col gap-4", className)}>Loading...</div>;
  }

  return (
    <div className={cn("w-full flex flex-col gap-4", className)}>
      {/* Progress bars section */}
      {plansProgressData.map((planProgressData, index) => {
        const { plan, weeks, achievement } = planProgressData;

        const shouldShow = index == 0 || isExpanded;
        const isCoached = index == 0 && userPaidPlanType != "FREE";

        // Find the complete plan data
        const completePlan = activePlans.find(p => p.id === plan.id);
        if (!completePlan) return null;

        return (
          <PlanProgressCard
            key={plan.id}
            plan={completePlan}
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
