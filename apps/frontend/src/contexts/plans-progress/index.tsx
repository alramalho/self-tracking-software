"use client";

import { useApiWithAuth } from "@/api";
import { dummyPlanProgressData } from "@/app/onboarding/components/steps/AIPartnerFinder";
import { useLogError } from "@/hooks/useLogError";
import { useSession } from "@clerk/clerk-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PlanProgressData } from "@tsw/prisma/types";
import { isFuture, isSameWeek } from "date-fns";
import React, { createContext, useContext, useEffect } from "react";
import { toast } from "react-hot-toast";
import { usePlans } from "../plans";
import { useCurrentUser, useUser } from "../users";
import {
  computePlansProgress,
  fetchPlanProgress as fetchPlanProgressService,
  fetchPlansProgress,
  normalizePlanProgress,
} from "./service";

export type { PlanProgressData };

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

  // Compute fresh progress (for after activity logging)
  computeProgressForUserPlans: (activityIds: string[]) => Promise<void>;
}

const PlansProgressContext = createContext<
  PlansProgressContextType | undefined
>(undefined);

export const PlansProgressProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isSignedIn, isLoaded } = useSession();
  const api = useApiWithAuth();
  const { handleQueryError } = useLogError();
  const queryClient = useQueryClient();
  const { plans } = usePlans();
  const { currentUser } = useCurrentUser();
  
  const fetchPlanProgress = async (
    planId: string
  ): Promise<PlanProgressData> => {
    const progress = await fetchPlanProgressService(api, planId);
    queryClient.setQueryData(["plan-progress", planId], progress);
    return progress;
  };

  const fetchBatchPlanProgress = async (
    planIds: string[]
  ): Promise<PlanProgressData[]> => {
    if (planIds.length === 0) return [];

    const progressList = await fetchPlansProgress(api, planIds);
    progressList.forEach((planProgress) => {
      queryClient.setQueryData(["plan-progress", planProgress.plan.id], planProgress);
    });
    return progressList;
  };

  // Single plan progress hook
  const usePlanProgress = (planId: string) => {
    const { data, isLoading, error } = useQuery({
      queryKey: ["plan-progress", planId],
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
      queryFn: async () => {
        // Check which plans already have cached data
        const cachedData: PlanProgressData[] = [];
        const missingPlanIds: string[] = [];
        
        planIds.forEach(planId => {
          const queryState = queryClient.getQueryState(["plan-progress", planId]);
          const existingDataRaw = queryState?.data as PlanProgressData | undefined;
          const isInvalidated = queryState ? queryState.isInvalidated : true;

          if (existingDataRaw && !isInvalidated) {
            cachedData.push(normalizePlanProgress(existingDataRaw));
          } else {
            missingPlanIds.push(planId);
          }
        });
        
        // Fetch only missing plans
        const newData = missingPlanIds.length > 0 
          ? await fetchBatchPlanProgress(missingPlanIds)
          : [];
        
        // Combine cached and new data, maintaining original order
        return planIds.map(planId => {
          const cached = cachedData.find(d => d.plan.id === planId);
          const fresh = newData.find(d => d.plan.id === planId);
          return cached || fresh!;
        });
      },
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
      isLoading,
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

  const computeProgressForUserPlans = async (activityIds: string[]) => {
    if (!currentUser?.id || !activityIds.length) return;

    try {
      // Find all user's plans that use the affected activities
      const userPlans = plans || [];
      const affectedPlanIds = userPlans
        .filter(plan => 
          plan.activities?.some(activity => activityIds.includes(activity.id))
        )
        .map(plan => plan.id);

      if (affectedPlanIds.length === 0) return;

      // Compute fresh progress for affected plans
      const freshProgressData = await computePlansProgress(api, affectedPlanIds);
      
      // Update query cache with fresh data
      freshProgressData.forEach((planProgress) => {
        queryClient.setQueryData(["plan-progress", planProgress.plan.id], planProgress);
      });

      // Invalidate batch queries that might include these plans
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return key[0] === "plans-progress" && Array.isArray(key[1]);
        },
      });

      console.log(`Computed fresh progress for ${affectedPlanIds.length} plans after activity logging`);
    } catch (error) {
      console.error("Failed to compute progress after activity logging:", error);
      // Don't throw - this is a background operation
    }
  };

  const context: PlansProgressContextType = {
    usePlanProgress,
    usePlansProgress,
    useUserProgress,
    computeProgressForUserPlans,
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
    throw new Error(
      "usePlansProgressContext must be used within a PlansProgressProvider"
    );
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

export const useComputeProgressForUserPlans = () => {
  const { computeProgressForUserPlans } = usePlansProgressContext();
  return computeProgressForUserPlans;
};
