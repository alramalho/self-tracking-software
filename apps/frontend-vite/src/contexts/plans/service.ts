import { type PlanInvitation, Prisma } from "@tsw/prisma";
import { type PlanProgressData } from "@tsw/prisma/types";
import { type AxiosInstance } from "axios";
import { normalizeApiResponse } from "../../utils/dateUtils";
import { normalizePlanProgress } from "../plans-progress/service";

type PlanWithRelationsBase = Prisma.PlanGetPayload<{
  include: {
    activities: true;
    sessions: true;
    planGroup: {
      include: {
        members: true;
      };
    };
    milestones: true;
  };
}>;

export type PlanWithRelations = PlanWithRelationsBase & {
  progress: PlanProgressData;
};

type PlanApiResponse = Omit<
  PlanWithRelations,
  | "createdAt"
  | "updatedAt"
  | "finishingDate"
  | "deletedAt"
  | "suggestedByCoachAt"
  | "sessions"
  | "milestones"
  | "planGroup"
  | "progress"
> & {
  createdAt: string;
  updatedAt: string;
  finishingDate: string | null;
  deletedAt: string | null;
  suggestedByCoachAt: string | null;
  sessions: Array<
    Omit<
      PlanWithRelationsBase["sessions"][number],
      "date" | "createdAt" | "updatedAt"
    > & {
      date: string;
      createdAt: string;
      updatedAt: string;
    }
  >;
  milestones: Array<
    Omit<PlanWithRelationsBase["milestones"][number], "date" | "createdAt"> & {
      date: string;
      createdAt: string;
    }
  >;
  planGroup: PlanWithRelationsBase["planGroup"] extends null
    ? null
    : Omit<NonNullable<PlanWithRelationsBase["planGroup"]>, "createdAt"> & {
        createdAt: string;
      };
  progress: any; // Will be properly typed by normalizePlanProgress
};

type PlanInvitationApiResponse = Omit<
  PlanInvitation,
  "createdAt" | "updatedAt"
> & {
  createdAt: string;
  updatedAt: string | null;
};

const deserializePlan = (plan: PlanApiResponse): PlanWithRelations => {
  const activities =
    (plan as unknown as { activities?: PlanWithRelationsBase["activities"] })
      .activities || [];
  const normalized = normalizeApiResponse<Omit<PlanWithRelations, 'progress'>>({ ...plan, activities }, [
    "createdAt",
    "updatedAt",
    "deletedAt",
    "finishingDate",
    "suggestedByCoachAt",
    "sessions.date",
    "sessions.createdAt",
    "sessions.updatedAt",
    "milestones.date",
    "milestones.createdAt",
    "planGroup.createdAt",
  ]);

  return {
    ...normalized,
    progress: normalizePlanProgress(plan.progress)
  };
};

const deserializePlanInvitation = (
  invitation: PlanInvitationApiResponse
): PlanInvitation =>
  normalizeApiResponse<PlanInvitation>(invitation, ["createdAt", "updatedAt"]);

const deserializeMilestone = (
  milestone: PlanApiResponse["milestones"][number]
) => normalizeApiResponse(milestone, ["date", "createdAt"]);

export async function getPlans(api: AxiosInstance) {
  const response = await api.get<PlanApiResponse[]>("/plans");
  return response.data.map(deserializePlan);
}

export async function fetchPlan(
  api: AxiosInstance,
  id: string,
  options?: { includeActivities?: boolean }
) {
  const query = options?.includeActivities ? "?includeActivities=true" : "";
  const response = await api.get<PlanApiResponse>(`/plans/${id}${query}`);
  return deserializePlan(response.data);
}

export async function updatePlans(
  api: AxiosInstance,
  updates: Array<{ planId: string; updates: Prisma.PlanUpdateInput }>
) {
  const response = await api.patch<{ success: boolean }>("/plans/bulk-update", {
    updates,
  });
  return response.data;
}

export async function fetchPlanInvitation(api: AxiosInstance, id: string) {
  const response = await api.get<PlanInvitationApiResponse>(
    `/plans/plan-invitations/${id}`
  );
  return deserializePlanInvitation(response.data);
}

export async function modifyManualMilestone(
  api: AxiosInstance,
  milestoneId: string,
  delta: number
) {
  const response = await api.post<{
    success: boolean;
    milestone: PlanApiResponse["milestones"][number];
  }>(`/plans/milestones/${milestoneId}/modify`, { delta });

  return {
    ...response.data,
    milestone: deserializeMilestone(response.data.milestone),
  };
}

export async function clearCoachSuggestedSessionsInPlan(
  api: AxiosInstance,
  planId: string
) {
  await api.post(`/plans/${planId}/clear-coach-suggested-sessions`);
}

export async function upgradeCoachSuggestedSessionsToPlanSessions(
  api: AxiosInstance,
  planId: string
) {
  await api.post(`/plans/${planId}/upgrade-coach-suggested-sessions`);
}
