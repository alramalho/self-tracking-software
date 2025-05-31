import React from "react";
import { ApiPlan } from "@/contexts/UserPlanContext";
import FireBadge from "./FireBadge";
import { usePlanProgress } from "@/contexts/PlanProgressContext";

interface PlanStreakProps {
  plan: ApiPlan;
}

const PlanStreak: React.FC<PlanStreakProps> = ({ plan }) => {
  const { plansProgress } = usePlanProgress();
  const planProgress = plansProgress.find((p) => p.plan.id === plan.id);

  if (!planProgress) {
    return null;
  }

  return (
    <FireBadge>
      <span className="opacity-100 ml-1">{planProgress.plan.emoji}</span>
      <span className="opacity-100 ml-1">
        x{planProgress.achievement.streak}
      </span>
    </FireBadge>
  );
};

export default PlanStreak;
