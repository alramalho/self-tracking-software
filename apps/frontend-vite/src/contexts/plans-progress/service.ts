import {
  type Activity,
  type ActivityEntry,
  type PlanSession,
} from "@tsw/prisma";
import { type PlanProgressData } from "@tsw/prisma/types";
import { type AxiosInstance } from "axios";
import { normalizeApiResponse } from "../../utils/dateUtils";

export interface PlanWeekData {
  startDate: Date;
  activities: Activity[];
  completedActivities: ActivityEntry[];
  plannedActivities: number | PlanSession[];
  weekActivities: Activity[];
  isCompleted: boolean;
}

type PrimitivePlanWeek = Omit<
  PlanWeekData,
  "startDate" | "completedActivities" | "plannedActivities"
> & {
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
  plannedActivities:
    | number
    | Array<
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
  const normalized = normalizeApiResponse<PlanProgressData>(payload, [
    "weeks.startDate",
    "weeks.completedActivities.datetime",
    "weeks.completedActivities.createdAt",
    "weeks.completedActivities.updatedAt",
    "weeks.completedActivities.imageCreatedAt",
    "weeks.completedActivities.imageExpiresAt",
    "weeks.completedActivities.deletedAt",
    "weeks.plannedActivities.date",
    "weeks.plannedActivities.createdAt",
    "weeks.plannedActivities.updatedAt",
  ]);

  return normalized;
};

export async function fetchPlansProgress(
  api: AxiosInstance,
  planIds: string[],
  forceRecompute?: boolean
): Promise<PlanProgressData[]> {
  if (!planIds.length) return [];

  const response = await api.post<{ progress: PlanProgressApiResponse[] }>(
    "/plans/batch-progress",
    { planIds, forceRecompute }
  );

  const normalized = response.data.progress.map(normalizePlanProgress);
  return normalized;
}

export async function computePlansProgress(
  api: AxiosInstance,
  planIds: string[]
): Promise<PlanProgressData[]> {
  if (!planIds.length) return [];

  const response = await api.post<{ progress: PlanProgressApiResponse[] }>(
    "/plans/batch-progress/compute",
    { planIds }
  );

  return response.data.progress.map(normalizePlanProgress);
}

export async function fetchPlanProgress(
  api: AxiosInstance,
  planId: string,
  forceRecompute?: boolean
): Promise<PlanProgressData> {
  const [progress] = await fetchPlansProgress(api, [planId], forceRecompute);
  if (!progress) {
    throw new Error(`Plan ${planId} not found`);
  }
  return progress;
}

export async function computePlanProgress(
  api: AxiosInstance,
  planId: string
): Promise<PlanProgressData> {
  const response = await api.post<PlanProgressApiResponse>(
    `/plans/${planId}/progress/compute`
  );

  return normalizePlanProgress(response.data);
}
