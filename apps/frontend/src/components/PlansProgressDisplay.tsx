import { usePlanProgress } from "@/contexts/PlanProgressContext";
import { CompletePlan } from "@/contexts/plans";
import { usePaidPlan } from "@/hooks/usePaidPlan";
import { cn } from "@/lib/utils";
import React from "react";
import { PlanProgressCard } from "./PlanProgressCard";
import PlansCarousel from "./PlansCarousel";



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
    <div className={cn("w-full", className)}>
      <PlansCarousel>
        {plansProgress.map((planProgressData, index) => {
          const { plan, weeks, achievement } = planProgressData;
          const isCoached = index == 0 && userPaidPlanType != "FREE";

          return (
            <div key={plan.id} className="embla__slide flex-[0_0_100%] min-w-0">
              <PlanProgressCard
                plan={plan as CompletePlan}
                weeks={weeks}
                achievement={achievement}
                isCoached={isCoached}
                isExpanded={true}
                className="shadow-sm"
              />
            </div>
          );
        })}
      </PlansCarousel>
    </div>
  );
};
