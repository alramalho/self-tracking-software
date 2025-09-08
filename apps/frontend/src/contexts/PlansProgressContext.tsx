"use client";

import { useApiWithAuth } from "@/api";
import { useQueries } from "@tanstack/react-query";

export interface PlanProgress {
  plan: {
    id: string;
    goal: string;
    emoji: string;
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
}

// Main hook following the pattern from plans context
export const usePlansProgress = (planIds: string[]) => {
  const api = useApiWithAuth();

  const fetchPlanProgress = async (planId: string): Promise<PlanProgress> => {
    const response = await api.get(`/plans/${planId}/progress`);
    if (response.status !== 200) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.data;
  };

  const queries = useQueries({
    queries: planIds.map(planId => ({
      queryKey: ['planProgress', planId],
      queryFn: () => fetchPlanProgress(planId),
      enabled: !!planId,
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
    })),
  });

  const data = queries
    .filter(query => query.data)
    .map(query => query.data!);
  
  const isLoading = queries.some(query => query.isLoading);
  const error = queries.find(query => query.error)?.error;

  return { data, isLoading, error };
};