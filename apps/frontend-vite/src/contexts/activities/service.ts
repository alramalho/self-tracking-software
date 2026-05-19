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
    sharedActivityEntry: {
      include: {
        sharedActivity: {
          include: {
            entries: {
              include: {
                user: {
                  select: {
                    id: true;
                    username: true;
                    name: true;
                    picture: true;
                  };
                };
                activityEntry: {
                  select: {
                    id: true;
                    userId: true;
                    deletedAt: true;
                  };
                };
              };
            };
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

export async function getActivitiyEntries(api: AxiosInstance, sinceDays = 90) {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();
  const response = await api.get<ActivityEntryWithRelations[]>(
    `/activities/activity-entries?since=${since}`
  );
  return response.data;
}

export async function deleteAchievementPost(
  api: AxiosInstance,
  achievementPostId: string
) {
  await api.delete(`/achievements/${achievementPostId}`);
}


export async function getSharedActivityCandidates(
  api: AxiosInstance,
  activityEntryId: string
) {
  const response = await api.get(
    `/activities/activity-entries/${activityEntryId}/shared-candidates`
  );
  return response.data.candidates;
}

export async function linkSharedActivity(
  api: AxiosInstance,
  activityEntryId: string,
  candidateActivityEntryId: string
) {
  const response = await api.post(
    `/activities/activity-entries/${activityEntryId}/shared-link`,
    { candidateActivityEntryId }
  );
  return response.data;
}

export async function unlinkSharedActivity(api: AxiosInstance, activityEntryId: string) {
  const response = await api.delete(
    `/activities/activity-entries/${activityEntryId}/shared-link`
  );
  return response.data;
}
