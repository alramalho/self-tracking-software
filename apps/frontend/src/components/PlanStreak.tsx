import { usePlanProgress } from "@/contexts/plans-progress";
import React from "react";
import FireBadge from "./FireBadge";

interface PlanStreakProps {
  plan: {
    id: string;
  };
}

const PlanStreak: React.FC<PlanStreakProps> = ({ plan }) => {
  const { data: planProgress } = usePlanProgress(plan.id);

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
