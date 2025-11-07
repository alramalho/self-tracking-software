import type { Activity, ActivityEntry } from "@tsw/prisma";
import { createContext } from "react";
import type { getActivities, getActivitiyEntries } from "./service";

export type ReturnedActivityEntriesType = Awaited<
  ReturnType<typeof getActivitiyEntries>
>;
export type ReturnedActivitiesType = Awaited<ReturnType<typeof getActivities>>;
export interface ActivityLogData {
  activityId: string;
  datetime: Date;
  quantity: number;
  description?: string;
  photo?: File;
}

export interface ActivitiesContextType {
  activities: ReturnedActivitiesType;
  activityEntries: ReturnedActivityEntriesType;
  isLoadingActivities: boolean;
  isLoadingActivityEntries: boolean;

  logActivity: (data: ActivityLogData) => Promise<void>;
  isLoggingActivity: boolean;

  upsertActivity: (data: {
    activity: Partial<Activity>;
    muteNotification?: boolean;
  }) => Promise<void>;
  upsertActivityEntry: (data: {
    entry: Partial<ActivityEntry>;
    muteNotification?: boolean;
  }) => Promise<void>;
  isUpsertingActivityEntry: boolean;
  isUpsertingActivity: boolean;

  deleteActivity: (data: { id: string }) => Promise<string>;
  deleteActivityEntry: (data: { id: string; activityId: string }) => Promise<{
    id: string;
    activityId: string;
  }>;
  isDeletingActivity: boolean;
  isDeletingActivityEntry: boolean;

  modifyReactions: (data: {
    activityEntryId: string;
    userUsername: string;
    reactions: { emoji: string; operation: "add" | "remove" }[];
  }) => Promise<void>;
  isModifyingReactions: boolean;

  addComment: (data: {
    activityEntryId: string;
    userUsername: string;
    text: string;
  }) => Promise<void>;
  removeComment: (data: {
    activityEntryId: string;
    userUsername: string;
    commentId: string;
  }) => Promise<void>;
  isAddingComment: boolean;
  isRemovingComment: boolean;

  // Achievement post reactions and comments
  modifyReactionsOnAchievement: (data: {
    achievementPostId: string;
    userUsername: string;
    reactions: { emoji: string; operation: "add" | "remove" }[];
  }) => Promise<void>;
  addCommentToAchievement: (data: {
    achievementPostId: string;
    userUsername: string;
    text: string;
  }) => Promise<void>;
  removeCommentFromAchievement: (data: {
    achievementPostId: string;
    userUsername: string;
    commentId: string;
  }) => Promise<void>;
}

export const ActivitiesContext = createContext<
  ActivitiesContextType | undefined
>(undefined);
