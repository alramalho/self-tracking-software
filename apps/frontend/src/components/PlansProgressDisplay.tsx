import { usePlanProgress } from "@/contexts/PlanProgressContext";
import { CompletePlan } from "@/contexts/plans";
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
  const { plansProgress } = usePlanProgress();

  return (
    <div className={cn("w-full flex flex-col gap-4", className)}>
      {/* Progress bars section */}
      {plansProgress.map((planProgressData, index) => {
        const { plan, weeks, achievement } = planProgressData;

        const shouldShow = index == 0 || isExpanded;
        const isCoached = index == 0 && userPaidPlanType != "FREE";

        return (
          <PlanProgressCard
            key={plan.id}
            plan={plan as CompletePlan}
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
