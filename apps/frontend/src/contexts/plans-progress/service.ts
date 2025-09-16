import { AxiosInstance } from "axios";
import {
  Activity,
  ActivityEntry,
  PlanOutlineType,
  PlanSession,
} from "@tsw/prisma";
import { normalizeApiResponse } from "../../utils/dateUtils";

export interface PlanWeekData {
  startDate: Date;
  activities: Activity[];
  completedActivities: ActivityEntry[];
  plannedActivities: number | PlanSession[];
  weekActivities: Activity[];
  isCompleted: boolean;
}

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
  weeks: PlanWeekData[];
}

type PrimitivePlanWeek = Omit<PlanWeekData, "startDate" | "completedActivities" | "plannedActivities"> & {
  startDate: string | Date;
  completedActivities: Array<
    Omit<
      ActivityEntry,
      | "date"
      | "createdAt"
      | "updatedAt"
      | "imageCreatedAt"
      | "imageExpiresAt"
      | "deletedAt"
    > & {
      date: string | Date;
      createdAt: string | Date;
      updatedAt: string | Date;
      imageCreatedAt?: string | Date | null;
      imageExpiresAt?: string | Date | null;
      deletedAt?: string | Date | null;
    }
  >;
  plannedActivities: number |
    Array<
      Omit<PlanSession, "date" | "createdAt" | "updatedAt"> & {
        date: string | Date;
        createdAt: string | Date;
        updatedAt: string | Date;
      }
    >;
};

type PlanProgressApiResponse = Omit<PlanProgressData, "weeks"> & {
  weeks: PrimitivePlanWeek[];
};

export const normalizePlanProgress = (
  payload: PlanProgressApiResponse | PlanProgressData
): PlanProgressData => {
  return normalizeApiResponse<PlanProgressData>(payload, [
    'weeks.startDate',
    'weeks.completedActivities.date',
    'weeks.completedActivities.createdAt', 
    'weeks.completedActivities.updatedAt',
    'weeks.completedActivities.imageCreatedAt',
    'weeks.completedActivities.imageExpiresAt',
    'weeks.completedActivities.deletedAt'
  ]);
};

export async function fetchPlansProgress(
  api: AxiosInstance,
  planIds: string[]
): Promise<PlanProgressData[]> {
  if (!planIds.length) return [];

  const response = await api.post<{ progress: PlanProgressApiResponse[] }>(
    "/plans/batch-progress",
    { planIds }
  );

  return response.data.progress.map(normalizePlanProgress);
}

export async function fetchPlanProgress(
  api: AxiosInstance,
  planId: string
): Promise<PlanProgressData> {
  const [progress] = await fetchPlansProgress(api, [planId]);
  if (!progress) {
    throw new Error(`Plan ${planId} not found`);
  }
  return progress;
}
