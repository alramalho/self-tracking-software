import { useApiWithAuth } from "@/api";
import { Activity, ActivityEntry, PlanSession } from "@tsw/prisma";
import { isAfter } from "date-fns";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
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
  planProgressData: Record<string, BackendPlanProgress>;
  getPlanProgress: (planId: string) => PlanAchievementResult | undefined;
  getPlanProgressFromBackend: (planId: string) => BackendPlanProgress | undefined;
  refreshPlanProgress: (planId: string) => Promise<void>;
}

const PlanProgressContext = createContext<PlanProgressContextType | undefined>(
  undefined
);
export const PlanProgressProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { plans } = usePlans();
  const { activities, activityEntries } = useActivities();
  const [planProgressData, setPlanProgressData] = useState<Record<string, BackendPlanProgress>>({});
  const api = useApiWithAuth();

  // Fetch plan progress from backend
  const fetchPlanProgress = async (planId: string): Promise<BackendPlanProgress | null> => {
    try {
      const response = await api.get(`/plans/${planId}/progress`);

      if (response.status !== 200) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: BackendPlanProgress = await response.data;
      return data;
    } catch (error) {
      console.error(`Error fetching progress for plan ${planId}:`, error);
      return null;
    }
  };

  const refreshPlanProgress = async (planId: string) => {
    const progress = await fetchPlanProgress(planId);
    if (progress) {
      setPlanProgressData(prev => ({
        ...prev,
        [planId]: progress,
      }));
    }
  };

  // Load progress for all active plans
  useEffect(() => {
    if (!plans) return;

    const activePlans = plans.filter(p => p.deletedAt === null && (p.finishingDate ? isAfter(p.finishingDate, new Date()) : true));
    
    activePlans.forEach(plan => {
      refreshPlanProgress(plan.id);
    });
  }, [plans]);

  const plansProgress = useMemo(() => {
    if (
      !plans ||
      !activities ||
      !activityEntries
    ) {
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
    planId: string
  ): BackendPlanProgress | undefined => {
    return planProgressData[planId];
  };

  const context: PlanProgressContextType = {
    calculatePlanAchievement,
    plansProgress,
    planProgressData,
    getPlanProgress,
    getPlanProgressFromBackend,
    refreshPlanProgress,
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
