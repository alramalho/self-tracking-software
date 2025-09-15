"use client";

import { useApiWithAuth } from "@/api";
import { dummyPlanProgressData } from "@/app/onboarding/components/steps/AIPartnerFinder";
import { useLogError } from "@/hooks/useLogError";
import { useSession } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ActivityEntry,
  PlanOutlineType,
  PlanSession,
} from "@tsw/prisma";
import { isFuture, isSameWeek } from "date-fns";
import React, { createContext, useContext, useEffect } from "react";
import { toast } from "react-hot-toast";
import { useCurrentUser, useUser } from "../users";

export interface PlanProgressData {
  planId: string;
  plan: {
    emoji: string;
    goal: string;
    id: string;
    type: PlanOutlineType;
  };
  achievement: {
    streak: number;
    completedWeeks: number;
    incompleteWeeks: number;
    totalWeeks: number;
  };
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
  weeks: Array<{
    startDate: Date;
    activities: Activity[];
    completedActivities: ActivityEntry[];
    plannedActivities: number | PlanSession[];
    weekActivities: Activity[]; // TODO: remove this BS
    isCompleted: boolean;
  }>;
}

interface PlansProgressContextType {
  // Single plan progress
  usePlanProgress: (planId: string) => {
    data: PlanProgressData | undefined;
    isLoading: boolean;
    error: Error | null;
    isWeekCompleted: (date: Date) => boolean;
  };

  // Multiple plans progress
  usePlansProgress: (planIds: string[]) => {
    data: PlanProgressData[];
    isLoading: boolean;
  };

  // User progress
  useUserProgress: (userId?: string) => {
    totalStreaks: number;
    totalHabits: number;
    totalLifestyles: number;
  };
}

const PlansProgressContext = createContext<PlansProgressContextType | undefined>(undefined);

export const PlansProgressProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isSignedIn, isLoaded } = useSession();
  const api = useApiWithAuth();
  const { handleQueryError } = useLogError();

  const fetchPlanProgress = async (
    planId: string
  ): Promise<PlanProgressData> => {
    // Use batch endpoint with single plan ID
    const batchData = await fetchBatchPlanProgress([planId]);
    if (batchData.length === 0) {
      throw new Error(`Plan ${planId} not found`);
    }
    return batchData[0];
  };

  const fetchBatchPlanProgress = async (
    planIds: string[]
  ): Promise<PlanProgressData[]> => {
    if (planIds.length === 0) return [];
    
    const response = await api.post('/plans/batch-progress', { planIds });
    if (response.status !== 200) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    // Parse ISO date strings to Date objects
    const data = response.data.progress;
    return data.map((planProgress: any) => ({
      ...planProgress,
      weeks: planProgress.weeks.map((week: any) => ({
        ...week,
        startDate: new Date(week.startDate),
      }))
    }));
  };

  // Single plan progress hook
  const usePlanProgress = (planId: string) => {
    const { data, isLoading, error } = useQuery({
      queryKey: ["planProgress", planId],
      queryFn: () => {
        if (planId == "demo-coach-plan") {
          return dummyPlanProgressData;
        }
        return fetchPlanProgress(planId);
      },
      enabled: isLoaded && isSignedIn && !!planId,
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
    });

    useEffect(() => {
      if (error) {
        handleQueryError(error, `Failed to get plan progress for ${planId}`);
        toast.error("Failed to load plan progress");
      }
    }, [error, planId, handleQueryError]);


    return {
      data,
      isLoading,
      error,
      isWeekCompleted: (date: Date) =>
        isFuture(date)
          ? false
          : data?.weeks?.find((week) => isSameWeek(week.startDate, date))
              ?.isCompleted ?? false,
    };
  };

  // Multiple plans progress hook
  const usePlansProgress = (planIds: string[]) => {
    const { data, isLoading, error } = useQuery({
      queryKey: ["plans-progress", planIds.sort()], // Sort for consistent cache keys
      queryFn: () => fetchBatchPlanProgress(planIds),
      enabled: isLoaded && isSignedIn && planIds.length > 0,
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
    });

    useEffect(() => {
      if (error) {
        handleQueryError(error, `Failed to get batch plan progress`);
        toast.error("Failed to load plans progress");
      }
    }, [error, handleQueryError]);

    return { 
      data: data || [], 
      isLoading 
    };
  };

  const useUserProgress = (userId?: string) => {
    const { currentUser } = useCurrentUser();
    const userIdToUse = userId || currentUser?.id || "";
    const { data: userData } = useUser({ id: userIdToUse });
    const { data: planProgressData, isLoading } = usePlansProgress(
      userData?.plans?.map((plan) => plan.id) || []
    );

    if (!planProgressData || isLoading) {
      return {
        totalStreaks: 0,
        totalHabits: 0,
        totalLifestyles: 0,
      };
    }

    return {
      totalStreaks: planProgressData.reduce((acc, planProgress) => {
        const newAcc = acc + planProgress.achievement?.streak;
        return newAcc;
      }, 0),
      totalHabits: planProgressData.reduce(
        (acc, planProgress) =>
          acc + (planProgress.habitAchievement?.isAchieved ? 1 : 0),
        0
      ),
      totalLifestyles: planProgressData.reduce(
        (acc, planProgress) =>
          acc + (planProgress.lifestyleAchievement?.isAchieved ? 1 : 0),
        0
      ),
    };
  };

  const context: PlansProgressContextType = {
    usePlanProgress,
    usePlansProgress,
    useUserProgress,
  };

  return (
    <PlansProgressContext.Provider value={context}>
      {children}
    </PlansProgressContext.Provider>
  );
};

// Hook to use the plans progress context
export const usePlansProgressContext = () => {
  const context = useContext(PlansProgressContext);
  if (context === undefined) {
    throw new Error("usePlansProgressContext must be used within a PlansProgressProvider");
  }
  return context;
};

// Exported convenience hooks that use the context
export const usePlanProgress = (planId: string) => {
  const { usePlanProgress: hookFromContext } = usePlansProgressContext();
  return hookFromContext(planId);
};

export const usePlansProgress = (planIds: string[]) => {
  const { usePlansProgress: hookFromContext } = usePlansProgressContext();
  return hookFromContext(planIds);
};

export const useUserProgress = (userId?: string) => {
  const { useUserProgress: hookFromContext } = usePlansProgressContext();
  return hookFromContext(userId);
};

