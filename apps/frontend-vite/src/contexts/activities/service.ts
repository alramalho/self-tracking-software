import { type Activity, Prisma } from "@tsw/prisma";
import { type AxiosInstance } from "axios";

export type ActivityEntryWithRelations = Prisma.ActivityEntryGetPayload<{
  include: {
    comments: {
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
          };
        };
      };
    };
  };
}>;

export async function getActivities(api: AxiosInstance) {
  const response = await api.get<Activity[]>("/activities");
  return response.data;
}

export async function getActivitiyEntries(api: AxiosInstance) {
  const response = await api.get<ActivityEntryWithRelations[]>(
    "/activities/activity-entries"
  );
  return response.data;
}

export async function deleteAchievementPost(
  api: AxiosInstance,
  achievementPostId: string
) {
  await api.delete(`/achievements/${achievementPostId}`);
}
