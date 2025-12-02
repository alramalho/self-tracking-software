import { type Activity, Prisma } from "@tsw/prisma";
import { type PlanProgressData } from "@tsw/prisma/types";
import { type AxiosInstance } from "axios";
import { normalizeApiResponse } from "../../utils/dateUtils";
import { normalizePlanProgress } from "../plans-progress/service";

export type TimelineActivityEntry = Prisma.ActivityEntryGetPayload<{
  include: {
    activity: true;
    comments: {
      where: {
        deletedAt: null;
      };
      orderBy: {
        createdAt: "asc";
      };
      include: {
        user: {
          select: {
            id: true;
            username: true;
            picture: true;
          };
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
}>;

type TimelineUserBase = Prisma.UserGetPayload<{
  select: {
    id: true;
    username: true;
    name: true;
    picture: true;
    planType: true;
    plans: {
      include: {
        activities: {
          select: {
            id: true;
          };
        };
      };
    };
  };
}>;

export type TimelineUser = Omit<TimelineUserBase, "plans"> & {
  plans: Array<
    TimelineUserBase["plans"][number] & { progress: PlanProgressData }
  >;
};

export type TimelineAchievementPost = Prisma.AchievementPostGetPayload<{
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
      orderBy: {
        sortOrder: "asc";
      };
    };
    comments: {
      where: {
        deletedAt: null;
      };
      orderBy: {
        createdAt: "asc";
      };
      include: {
        user: {
          select: {
            id: true;
            username: true;
            picture: true;
          };
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
}>;

export interface TimelineData {
  recommendedActivityEntries: TimelineActivityEntry[];
  recommendedActivities: Activity[];
  recommendedUsers: TimelineUser[];
  achievementPosts: TimelineAchievementPost[];
}

function normalizeActivityEntry(
  entry: TimelineActivityEntry
): TimelineActivityEntry {
  return normalizeApiResponse<TimelineActivityEntry>(entry, [
    "datetime",
    "createdAt",
    "updatedAt",
    "deletedAt",
    "comments.createdAt",
    "comments.deletedAt",
    "reactions.createdAt",
  ]);
}

function normalizeActivity(activity: Activity): Activity {
  return normalizeApiResponse<Activity>(activity, [
    "createdAt",
    "updatedAt",
    "deletedAt",
  ]);
}

function normalizeUser(user: TimelineUser): TimelineUser {
  const normalized = normalizeApiResponse<TimelineUser>(user, [
    "plans.createdAt",
    "plans.updatedAt",
    "plans.finishingDate",
  ]);

  return {
    ...normalized,
    plans: normalized.plans.map((plan) => ({
      ...plan,
      progress: normalizePlanProgress(plan.progress),
    })),
  };
}

export function normalizeAchievementPost(
  post: TimelineAchievementPost
): TimelineAchievementPost {
  return normalizeApiResponse<TimelineAchievementPost>(post, [
    "createdAt",
    "deletedAt",
    "images.createdAt",
    "images.expiresAt",
    "comments.createdAt",
    "comments.deletedAt",
    "reactions.createdAt",
  ]);
}

export async function getTimelineData(
  api: AxiosInstance
): Promise<TimelineData> {
  const response = await api.get<TimelineData>("/users/timeline");
  const data = response.data;

  return {
    recommendedActivityEntries: data.recommendedActivityEntries.map(
      normalizeActivityEntry
    ),
    recommendedActivities: data.recommendedActivities.map(normalizeActivity),
    recommendedUsers: data.recommendedUsers.map(normalizeUser),
    achievementPosts: (data.achievementPosts || []).map(normalizeAchievementPost),
  };
}
