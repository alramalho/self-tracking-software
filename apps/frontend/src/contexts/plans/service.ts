import { PlanInvitation, Prisma } from "@tsw/prisma";
import { AxiosInstance } from "axios";
import { normalizeApiResponse, normalizeApiResponseArray } from "../../utils/dateUtils";

export type PlanWithRelations = Prisma.PlanGetPayload<{
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
> & {
  createdAt: string;
  updatedAt: string;
  finishingDate: string | null;
  deletedAt: string | null;
  suggestedByCoachAt: string | null;
  sessions: Array<
    Omit<
      PlanWithRelations["sessions"][number],
      "date" | "createdAt" | "updatedAt"
    > & {
      date: string;
      createdAt: string;
      updatedAt: string;
    }
  >;
  milestones: Array<
    Omit<PlanWithRelations["milestones"][number], "date" | "createdAt"> & {
      date: string;
      createdAt: string;
    }
  >;
  planGroup: PlanWithRelations["planGroup"] extends null
    ? null
    : Omit<NonNullable<PlanWithRelations["planGroup"]>, "createdAt"> & {
        createdAt: string;
      };
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
    (plan as unknown as { activities?: PlanWithRelations["activities"] })
      .activities || [];
  return normalizeApiResponse<PlanWithRelations>(
    { ...plan, activities },
    [
      'createdAt', 'updatedAt', 'deletedAt', 'finishingDate', 'suggestedByCoachAt',
      'sessions.date', 'sessions.createdAt', 'sessions.updatedAt',
      'milestones.date', 'milestones.createdAt',
      'planGroup.createdAt'
    ]
  );
};

const deserializePlanInvitation = (
  invitation: PlanInvitationApiResponse
): PlanInvitation => normalizeApiResponse<PlanInvitation>(invitation, ['createdAt', 'updatedAt']);

const deserializeMilestone = (
  milestone: PlanApiResponse["milestones"][number]
) => normalizeApiResponse(milestone, ['date', 'createdAt']);

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
