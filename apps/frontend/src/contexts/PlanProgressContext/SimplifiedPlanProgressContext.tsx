"use client";

import { useApiWithAuth } from "@/api";
import { useQueries, useQuery } from "@tanstack/react-query";
import {
  Activity,
  ActivityEntry,
  PlanOutlineType,
  PlanSession,
} from "@tsw/prisma";
import { isFuture, isSameWeek } from "date-fns";
import { useEffect } from "react";
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
    isAchieved: boolean;
    totalWeeks: number;
    weeksToAchieve?: number;
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
    weekActivities: Activity[];
    isCompleted: boolean;
  }>;
}

// Single plan progress hook
export const usePlanProgress = (planId: string) => {
  const api = useApiWithAuth();

  const fetchPlanProgress = async (
    planId: string
  ): Promise<PlanProgressData> => {
    const response = await api.get(`/plans/${planId}/progress`);
    if (response.status !== 200) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    // Parse ISO date strings to Date objects
    const data = response.data;
    if (data.weeks) {
      data.weeks = data.weeks.map((week: any) => ({
        ...week,
        startDate: new Date(week.startDate),
      }));
    }
    
    return data;
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ["planProgress", planId],
    queryFn: () => fetchPlanProgress(planId),
    enabled: !!planId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  if (data?.plan.goal === "train 4 times a week") {
    console.log({weeks: data?.weeks})
  }

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

// Multiple plans progress hook following the pattern from PlansProgressContext
export const usePlansProgress = (planIds: string[]) => {
  console.log(`usePlansProgress called with planIds: ${planIds}`);

  const api = useApiWithAuth();

  const fetchPlanProgress = async (
    planId: string
  ): Promise<PlanProgressData> => {
    console.log(`fetching plan progress for planId: ${planId}`);
    const response = await api.get(`/plans/${planId}/progress`);
    if (response.status !== 200) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    // Parse ISO date strings to Date objects
    const data = response.data;
    if (data.weeks) {
      data.weeks = data.weeks.map((week: any) => ({
        ...week,
        startDate: new Date(week.startDate),
      }));
    }
    
    return data;
  };

  const queries = useQueries({
    queries: planIds.map((planId) => ({
      queryKey: ["planProgress", planId],
      queryFn: () => {
        return fetchPlanProgress(planId);
      },
      enabled: !!planId,
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
    })),
  });

  const data = queries
    .filter((query) => query.data)
    .map((query) => query.data!);

  const isLoading = queries.some((query) => query.isLoading);

  return { data, isLoading };
};

const useUserProgress = (userId?: string) => {
  const { currentUser } = useCurrentUser();
  const userIdToUse = userId || currentUser?.id || "";
  const { data: userData } = useUser({ id: userIdToUse });
  const { data: planProgressData, isLoading } = usePlansProgress(
    userData?.plans?.map((plan) => plan.id) || []
  );

  useEffect(() => {
    console.log(`plans: ${userData?.plans?.map((p) => p.goal).join(", ")}`);

    console.log({ planProgressData });
  }, [planProgressData]);

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
      console.log(
        `plan ${planProgress.plan?.goal} has streak ${planProgress.achievement?.streak}`
      );
      console.log(`acc ${acc} -> ${newAcc}`);
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

export { useUserProgress as useCurrentUserProgress };
