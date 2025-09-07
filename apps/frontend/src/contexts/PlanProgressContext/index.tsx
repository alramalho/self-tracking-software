import { useApiWithAuth } from "@/api";
import { Activity, ActivityEntry, PlanSession } from "@tsw/prisma";
import { useQuery } from "@tanstack/react-query";
import { isAfter } from "date-fns";
import React, { createContext, useContext, useMemo } from "react";
import { useActivities } from "../activities";
import { CompletePlan, usePlans } from "../plans";
import { calculatePlanAchievement, getPlanWeeks } from "./lib";

// Re-export the new simplified API
export { usePlansProgress } from "../PlansProgressContext";

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

export interface BackendPlanProgress {
  planId: string;
  achievement: PlanAchievementResult;
  currentWeekStats: {
    numActiveDaysInTheWeek: number;
    numLeftDaysInTheWeek: number;
    numActiveDaysLeftInTheWeek: number;
    daysCompletedThisWeek: number;
  };
  habitAchievement: {
    progressValue: number;
    maxValue: number;
    isAchieved: boolean;
    progressPercentage: number;
  };
  lifestyleAchievement: {
    progressValue: number;
    maxValue: number;
    isAchieved: boolean;
    progressPercentage: number;
  };
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
  getPlanProgressFromBackend: (planId: string) => BackendPlanProgress | undefined;
  usePlanProgressQuery: (planId: string) => {
    data: BackendPlanProgress | undefined;
    isLoading: boolean;
    error: any;
    refetch: () => void;
  };
}

// Legacy context (deprecated, kept for backward compatibility)
const PlanProgressContext = createContext<PlanProgressContextType | undefined>(
  undefined
);

export const PlanProgressProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { plans } = usePlans();
  const { activities, activityEntries } = useActivities();
  const api = useApiWithAuth();

  const fetchPlanProgress = async (planId: string): Promise<BackendPlanProgress> => {
    const response = await api.get(`/plans/${planId}/progress`);
    if (response.status !== 200) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.data;
  };

  const usePlanProgressQuery = (planId: string) => {
    return useQuery({
      queryKey: ['planProgress', planId],
      queryFn: () => fetchPlanProgress(planId),
      enabled: !!planId,
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
    });
  };

  const plansProgress = useMemo(() => {
    if (!plans || !activities || !activityEntries) {
      return [];
    }

    const planProgress = plans.filter((p) => p.deletedAt === null && (p.finishingDate ? isAfter(p.finishingDate, new Date()) : true)).map((plan): PlanProgressData => {
      return {
        plan: plan as CompletePlan,
        achievement: calculatePlanAchievement(
          plan as CompletePlan,
          activityEntries,
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

  const getPlanProgressFromBackend = (
    _planId: string
  ): BackendPlanProgress | undefined => {
    console.warn("getPlanProgressFromBackend is deprecated, use usePlansProgress([planId]) instead");
    return undefined;
  };

  const context: PlanProgressContextType = {
    calculatePlanAchievement,
    plansProgress,
    getPlanProgress,
    getPlanProgressFromBackend,
    usePlanProgressQuery,
  };

  return (
    <PlanProgressContext.Provider value={context}>
      {children}
    </PlanProgressContext.Provider>
  );
};

// Legacy hook (deprecated, kept for backward compatibility)
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
