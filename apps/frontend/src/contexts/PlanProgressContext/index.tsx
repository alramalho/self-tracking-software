import { Activity, ActivityEntry, PlanSession } from "@tsw/prisma";
import { isAfter } from "date-fns";
import React, { createContext, useContext, useMemo } from "react";
import { useActivities } from "../activities";
import { CompletePlan, usePlans } from "../plans";
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
  plan: CompletePlan;
  weeks: PlanWeek[];
  achievement: PlanAchievementResult;
}

export interface PlanProgressContextType {
  calculatePlanAchievement: (
    plan: CompletePlan,
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
  const { plans } = usePlans();
  const { activities, activityEntries } = useActivities();

  const plansProgress = useMemo(() => {
    if (
      !plans ||
      !activities ||
      !activityEntries
    ) {
      return [];
    }

    const planProgress = plans.filter((p) => p.deletedAt === null && (p.finishingDate ? isAfter(p.finishingDate, new Date()) : true)).map((plan): PlanProgressData => {
      // const convertedPlan = plan;
      // const planStartDate = convertedPlan.outlineType === "SPECIFIC" 
      //   ? (convertedPlan.sessions.length > 0 
      //       ? convertedPlan.sessions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0].date
      //       : new Date())
      //   : undefined
      
      return {
        plan: plan as CompletePlan,
        achievement: calculatePlanAchievement(
          plan as CompletePlan,
          activityEntries,
          // planStartDate
        ),
        weeks: getPlanWeeks(
          plan as CompletePlan,
          activities,
          activityEntries
        ),
      };
    });
    return planProgress;
  }, [plans, activities, activityEntries]);

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
  plan: CompletePlan,
  activities: Activity[],
  activityEntries: ActivityEntry[]
): PlanProgressData => {
  const result = {
    plan,
    achievement: calculatePlanAchievement(plan, activityEntries),
    weeks: getPlanWeeks(plan, activities, activityEntries),
  };
  console.log(result);
  return result;
};
