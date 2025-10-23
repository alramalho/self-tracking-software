import { Prisma } from "@tsw/prisma";
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
        members: {
          include: {
            user: {
              select: {
                id: true;
                name: true;
                username: true;
                picture: true;
              };
            };
            plan: {
              select: {
                id: true;
                goal: true;
              };
            };
          };
        };
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

export type PlanGroupMemberInvitationPayload = Prisma.PlanGroupMemberGetPayload<{
  include: {
    planGroup: {
      include: {
        plans: {
          include: {
            activities: true;
          };
        };
      };
    };
    invitedBy: true;
  };
}>;

type PlanGroupMemberInvitationApiResponse = Omit<
  PlanGroupMemberInvitationPayload,
  "invitedAt" | "joinedAt" | "leftAt" | "planGroup" | "invitedBy"
> & {
  invitedAt: string;
  joinedAt: string | null;
  leftAt: string | null;
  planGroup: Omit<
    NonNullable<PlanGroupMemberInvitationPayload["planGroup"]>,
    "createdAt" | "plans"
  > & {
    createdAt: string;
    plans: Array<
      Omit<
        PlanGroupMemberInvitationPayload["planGroup"]["plans"][number],
        "createdAt" | "updatedAt" | "deletedAt" | "finishingDate" | "suggestedByCoachAt"
      > & {
        createdAt: string;
        updatedAt: string;
        deletedAt: string | null;
        finishingDate: string | null;
        suggestedByCoachAt: string | null;
      }
    >;
  };
  invitedBy: PlanGroupMemberInvitationPayload["invitedBy"];
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

const deserializePlanGroupMemberInvitation = (
  invitation: PlanGroupMemberInvitationApiResponse
): PlanGroupMemberInvitationPayload =>
  normalizeApiResponse<PlanGroupMemberInvitationPayload>(invitation, [
    "invitedAt",
    "joinedAt",
    "leftAt",
    "planGroup.createdAt",
    "planGroup.plans.createdAt",
    "planGroup.plans.updatedAt",
    "planGroup.plans.deletedAt",
    "planGroup.plans.finishingDate",
    "planGroup.plans.suggestedByCoachAt",
  ]);

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
  const response = await api.get<PlanGroupMemberInvitationApiResponse>(
    `/plans/plan-invitations/${id}`
  );
  return deserializePlanGroupMemberInvitation(response.data);
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

export async function deletePlan(api: AxiosInstance, planId: string) {
  const response = await api.delete<{ success: boolean; plan: PlanApiResponse }>(
    `/plans/${planId}`
  );
  return response.data;
}

export interface PlanGroupMemberProgress {
  userId: string;
  name: string;
  username: string | null;
  picture: string | null;
  planId: string;
  weeklyActivityCount: number;
  target: number;
  isCoached: boolean;
  status: "ON_TRACK" | "AT_RISK" | "FAILED" | "COMPLETED" | null;
}

export interface PlanGroupProgressData {
  planGroupId: string;
  members: PlanGroupMemberProgress[];
}

export async function getPlanGroupProgress(
  api: AxiosInstance,
  planId: string
): Promise<PlanGroupProgressData | null> {
  try {
    const response = await api.get<PlanGroupProgressData>(
      `/plans/${planId}/group-progress`
    );
    return response.data;
  } catch (error: any) {
    // Return null if plan has no group (400 error) or other errors
    if (error?.response?.status === 400 || error?.response?.status === 403) {
      return null;
    }
    throw error;
  }
}

export async function uploadPlanBackgroundImage(
  api: AxiosInstance,
  file: File
): Promise<string> {
  const formData = new FormData();
  formData.append("image", file);

  // Don't set Content-Type header - let the browser set it with the correct boundary
  const response = await api.post<{ success: boolean; url: string }>(
    "/plans/upload-background-image",
    formData
  );

  return response.data.url;
}
