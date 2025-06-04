import React, { createContext, useContext, useMemo } from "react";
import {
  useUserPlan,
  Activity,
  ActivityEntry,
  ApiPlan,
  PlanSession,
  convertApiPlanToPlan,
  Plan,
} from "@/contexts/UserPlanContext";
import { calculatePlanAchievement, getPlanWeeks } from "./lib";

export interface PlanAchievementResult {
  streak: number;
  completedWeeks: number;
  incompleteWeeks: number;
  isAchieved: boolean;
  totalWeeks: number;
  weeksToAchieve?: number;
}

export interface PlanWeek {
  startDate: Date;
  activities: Activity[];
  completedActivities: ActivityEntry[];
  plannedActivities: number | PlanSession[];
  weekActivities: Activity[];
}

export interface PlanProgressData {
  plan: Plan;
  weeks: PlanWeek[];
  achievement: PlanAchievementResult;
}

export interface PlanProgressContextType {
  calculatePlanAchievement: (
    plan: Plan,
    activities: Activity[],
    activityEntries: ActivityEntry[],
    initialDate?: Date
  ) => PlanAchievementResult;
  plansProgress: PlanProgressData[];
  getPlanProgress: (planId: string) => PlanAchievementResult | undefined;
}

const PlanProgressContext = createContext<PlanProgressContextType | undefined>(
  undefined
);
export const PlanProgressProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { useCurrentUserDataQuery } = useUserPlan();
  const currentUserQuery = useCurrentUserDataQuery();

  const userData = currentUserQuery.data;

  const plansProgress = useMemo(() => {
    if (
      !userData?.plans ||
      !userData?.activities ||
      !userData?.activityEntries
    ) {
      return [];
    }

    const { plans, activities, activityEntries } = userData;

    const planProgress = plans.map(
      (plan): PlanProgressData => ({
        plan: convertApiPlanToPlan(plan, activities),
        achievement: calculatePlanAchievement(
          convertApiPlanToPlan(plan, activities),
          activities,
          activityEntries
        ),
        weeks: getPlanWeeks(
          convertApiPlanToPlan(plan, activities),
          activities,
          activityEntries
        ),
      })
    );
    console.log("planProgress", planProgress);
    return planProgress;
  }, [userData?.plans, userData?.activities, userData?.activityEntries]);

  const getPlanProgress = (
    planId: string
  ): PlanAchievementResult | undefined => {
    return plansProgress.find((p) => p.plan.id === planId)?.achievement;
  };

  const context: PlanProgressContextType = {
    calculatePlanAchievement,
    plansProgress,
    getPlanProgress,
  };

  return (
    <PlanProgressContext.Provider value={context}>
      {children}
    </PlanProgressContext.Provider>
  );
};

export const usePlanProgress = () => {
  const context = useContext(PlanProgressContext);
  if (context === undefined) {
    throw new Error(
      "usePlanProgress must be used within a PlanProgressProvider"
    );
  }
  return context;
};
