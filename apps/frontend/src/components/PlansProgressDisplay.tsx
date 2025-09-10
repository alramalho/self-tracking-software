import { usePlanProgress } from "@/contexts/PlanProgressContext";
import { CompletePlan } from "@/contexts/plans";
import { usePaidPlan } from "@/hooks/usePaidPlan";
import { cn } from "@/lib/utils";
import React, { useState } from "react";
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
  const [animationDone, setAnimationDone] = useState(false);

  if (!animationDone && plansProgress.length > 0) {
    const firstPlanData = plansProgress[0];
    const { plan, weeks, achievement } = firstPlanData;
    const isCoached = userPaidPlanType != "FREE";

    return (
      <div className={cn("w-full flex-1", className)}>
        <PlanProgressCard
          plan={plan as CompletePlan}
          weeks={weeks}
          achievement={achievement}
          isCoached={isCoached}
          isExpanded={true}
          className="shadow-sm"
          onAnimationDone={() => {
            setAnimationDone(true)
          }}
        />
      </div>
    );
  }

  return (
    <div className={cn("w-full flex-1", className)}>
      <PlansCarousel>
        {plansProgress.map((planProgressData, index) => {
          const { plan, weeks, achievement } = planProgressData;
          const isCoached = index == 0 && userPaidPlanType != "FREE";

          return (
            <div
              key={plan.id}
              className="embla__slide flex-[0_0_100%] min-w-0 h-full"
            >
              <PlanProgressCard
                plan={plan as CompletePlan}
                weeks={weeks}
                achievement={achievement}
                isCoached={isCoached}
                isExpanded={true}
                className="shadow-sm"
                skipAnimation={true}
              />
            </div>
          );
        })}
      </PlansCarousel>
    </div>
  );
};
