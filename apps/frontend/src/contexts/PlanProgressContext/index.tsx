import { useApiWithAuth } from "@/api";
import { Activity, ActivityEntry, PlanSession } from "@tsw/prisma";
import { useQuery } from "@tanstack/react-query";
import React, { createContext, useContext, useMemo } from "react";
import { CompletePlan } from "../plans";
// Deprecated: Complex calculation logic moved to backend
// import { calculatePlanAchievement, getPlanWeeks } from "./lib";

// Re-export the new simplified API
export { usePlansProgress as useSimplifiedPlansProgress, usePlanProgress as useSimplifiedPlanProgress } from "./SimplifiedPlanProgressContext";

// Re-export types for backward compatibility
export type { PlanProgressData as SimplifiedPlanProgressData } from "./SimplifiedPlanProgressContext";

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
    console.warn("[DEPRECATED] PlanProgressContext.plansProgress is deprecated. Use useSimplifiedPlansProgress hook instead.");
    // Return empty array - components should migrate to use useSimplifiedPlansProgress
    return [];
  }, []);

  const getPlanProgress = (
    _planId: string
  ): PlanAchievementResult | undefined => {
    console.warn("[DEPRECATED] getPlanProgress is deprecated. Use useSimplifiedPlanProgress hook instead.");
    return undefined;
  };

  const getPlanProgressFromBackend = (
    _planId: string
  ): BackendPlanProgress | undefined => {
    console.warn("getPlanProgressFromBackend is deprecated, use usePlansProgress([planId]) instead");
    return undefined;
  };

  const context: PlanProgressContextType = {
    calculatePlanAchievement: () => {
      console.warn("[DEPRECATED] calculatePlanAchievement is deprecated. Use backend data via useSimplifiedPlanProgress instead.");
      return {
        streak: 0,
        completedWeeks: 0,
        incompleteWeeks: 0,
        isAchieved: false,
        totalWeeks: 0,
      };
    },
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
  _plan: CompletePlan,
  _activities: Activity[],
  _activityEntries: ActivityEntry[]
): PlanProgressData => {
  console.warn("[DEPRECATED] createPlanProgressData is deprecated. Use backend data via useSimplifiedPlanProgress instead.");
  return {
    plan: _plan,
    achievement: {
      streak: 0,
      completedWeeks: 0,
      incompleteWeeks: 0,
      isAchieved: false,
      totalWeeks: 0,
    },
    weeks: [],
  };
};
