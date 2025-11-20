import { Prisma } from "@tsw/prisma";
import { type PlanProgressData } from "@tsw/prisma/types";
import { type AxiosInstance } from "axios";
import { normalizeApiResponse } from "../../utils/dateUtils";
import { normalizePlanProgress } from "../plans-progress/service";

type BasicUserApiResponse = Prisma.UserGetPayload<{
  include: {
    connectionsFrom: {
      include: {
        to: {
          select: {
            id: true;
            username: true;
            name: true;
            picture: true;
          };
        };
      };
    };
    connectionsTo: {
      include: {
        from: {
          select: {
            id: true;
            username: true;
            name: true;
            picture: true;
          };
        };
      };
    };
  };
}>;

type FullUserApiResponseBase = Prisma.UserGetPayload<{
  include: {
    connectionsFrom: {
      include: {
        to: {
          select: {
            id: true;
            username: true;
            name: true;
            picture: true;
          };
        };
      };
    };
    connectionsTo: {
      include: {
        from: {
          select: {
            id: true;
            username: true;
            name: true;
            picture: true;
          };
        };
      };
    };
    plans: {
      include: {
        activities: {
          where: { deletedAt: null };
        };
      };
    };
    activities: {
      where: { deletedAt: null };
    };
    activityEntries: {
      where: { deletedAt: null };
      include: {
        activity: true;
        comments: {
          where: { deletedAt: null };
          orderBy: { createdAt: "asc" };
          include: {
            user: {
              select: { id: true; username: true; picture: true };
            };
          };
        };
        reactions: {
          include: {
            user: {
              select: {
                id: true;
                username: true;
                picture: true;
                planType: true;
              };
            };
          };
        };
      };
    };
    achievementPosts: {
      where: { deletedAt: null };
      orderBy: { createdAt: "desc" };
      include: {
        user: {
          select: {
            id: true;
            username: true;
            name: true;
            picture: true;
          };
        };
        plan: {
          select: {
            id: true;
            goal: true;
            emoji: true;
            backgroundImageUrl: true;
          };
        };
        images: {
          orderBy: { sortOrder: "asc" };
        };
        comments: {
          where: { deletedAt: null };
          orderBy: { createdAt: "asc" };
          include: {
            user: {
              select: { id: true; username: true; picture: true };
            };
          };
        };
        reactions: {
          include: {
            user: {
              select: {
                id: true;
                username: true;
                picture: true;
                planType: true;
              };
            };
          };
        };
      };
    };
  };
}>;

type FullUserApiResponse = Omit<FullUserApiResponseBase, "plans"> & {
  plans: Array<FullUserApiResponseBase["plans"][number] & { progress: any }>;
};

export type HydratedCurrentUser = BasicUserApiResponse;
export type HydratedUser = Omit<FullUserApiResponseBase, "plans"> & {
  plans: Array<
    FullUserApiResponseBase["plans"][number] & { progress: PlanProgressData }
  >;
};

function normalizeBasicUser(user: BasicUserApiResponse): HydratedCurrentUser {
  return normalizeApiResponse<HydratedCurrentUser>(user, [
    "createdAt",
    "updatedAt",
    "lastActiveAt",
    "connectionsFrom.createdAt",
    "connectionsFrom.updatedAt",
    "connectionsTo.createdAt",
    "connectionsTo.updatedAt",
  ]);
}

function normalizeFullUser(user: FullUserApiResponse): HydratedUser {
  const normalized = normalizeApiResponse<Omit<HydratedUser, "plans">>(user, [
    "createdAt",
    "updatedAt",
    "lastActiveAt",
    "connectionsFrom.createdAt",
    "connectionsFrom.updatedAt",
    "connectionsTo.createdAt",
    "connectionsTo.updatedAt",
    "plans.createdAt",
    "plans.updatedAt",
    "plans.deletedAt",
    "plans.finishingDate",
    "activities.createdAt",
    "activities.updatedAt",
    "activities.deletedAt",
    "activityEntries.datetime",
    "activityEntries.createdAt",
    "activityEntries.updatedAt",
    "activityEntries.deletedAt",
    "activityEntries.comments.createdAt",
    "activityEntries.comments.deletedAt",
    "activityEntries.reactions.createdAt",
  ]);

  return {
    ...normalized,
    plans: user.plans.map((plan) => ({
      ...plan,
      progress: normalizePlanProgress(plan.progress),
    })),
  };
}

export async function getCurrentUserBasicData(
  api: AxiosInstance
): Promise<HydratedCurrentUser> {
  const response = await api.get<BasicUserApiResponse>("/users/user");
  return normalizeBasicUser(response.data);
}

export async function getUserFullDataByUserNameOrId(
  api: AxiosInstance,
  data: Array<{ username?: string; id?: string }>
): Promise<HydratedUser> {
  const response = await api.post<FullUserApiResponse>("/users/get-user", {
    identifiers: data,
  });
  return normalizeFullUser(response.data);
}

export async function updateUser(
  api: AxiosInstance,
  updates: Prisma.UserUpdateInput
): Promise<HydratedCurrentUser> {
  const response = await api.patch<BasicUserApiResponse>(
    "/users/user",
    updates
  );
  return normalizeBasicUser(response.data);
}

export async function getPublicUserProfile(
  usernameOrId: string
): Promise<HydratedUser> {
  const baseUrl =
    import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL;

  if (!baseUrl) {
    throw new Error("Backend URL is not configured");
  }

  const response = await fetch(`${baseUrl}/users/public/${usernameOrId}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch public user: ${response.status}`);
  }

  const data: FullUserApiResponse = await response.json();
  return normalizeFullUser(data);
}

export async function deleteAccount(api: AxiosInstance): Promise<void> {
  await api.delete("/users/user");
}
