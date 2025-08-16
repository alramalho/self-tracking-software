import React, { createContext, useContext, useMemo } from "react";
import {
  useUserPlan,
} from "@/contexts/UserGlobalContext";
import { Plan, Activity, ActivityEntry, PlanSession } from "@/zero/schema";
import { calculatePlanAchievement, getPlanWeeks } from "./lib";
import { HydratedCurrentUser } from "@/zero/queries";

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
    plan: HydratedCurrentUser["plans"][number],
    activities: HydratedCurrentUser["activities"],
    activityEntries: HydratedCurrentUser["activityEntries"],
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

    const planProgress = plans.map((plan): PlanProgressData => {
      const convertedPlan = plan;
      // const planStartDate = convertedPlan.outlineType === "SPECIFIC" 
      //   ? (convertedPlan.sessions.length > 0 
      //       ? convertedPlan.sessions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0].date
      //       : new Date())
      //   : undefined
      
      return {
        plan: convertedPlan,
        achievement: calculatePlanAchievement(
          convertedPlan,
          activities,
          activityEntries,
          // planStartDate
        ),
        weeks: getPlanWeeks(
          convertedPlan,
          activities,
          activityEntries
        ),
      };
    });
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

// Export a function to create plan progress data independently (for demos)
export const createPlanProgressData = (
  plan: HydratedCurrentUser["plans"][number],
  activities: HydratedCurrentUser["activities"],
  activityEntries: HydratedCurrentUser["activityEntries"]
): PlanProgressData => {
  return {
    plan,
    achievement: calculatePlanAchievement(plan, activities, activityEntries),
    weeks: getPlanWeeks(plan, activities, activityEntries),
  };
};
