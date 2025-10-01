import { Prisma } from "@tsw/prisma";
import { type AxiosInstance } from "axios";
import { normalizeApiResponse } from "../../utils/dateUtils";

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

type FullUserApiResponse = Prisma.UserGetPayload<{
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
  };
}>;

export type HydratedCurrentUser = BasicUserApiResponse;
export type HydratedUser = FullUserApiResponse;

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
  return normalizeApiResponse<HydratedUser>(user, [
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
    "activityEntries.date",
    "activityEntries.createdAt",
    "activityEntries.updatedAt",
    "activityEntries.deletedAt",
    "activityEntries.comments.createdAt",
    "activityEntries.comments.deletedAt",
    "activityEntries.reactions.createdAt",
  ]);
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
