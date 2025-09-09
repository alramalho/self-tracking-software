"use client";

import { useApiWithAuth } from "@/api";
import { useLogError } from "@/hooks/useLogError";
import { useSession } from "@clerk/clerk-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, ActivityEntry } from "@tsw/prisma";
import React, { createContext, useContext } from "react";
import { toast } from "react-hot-toast";
import { TimelineData } from "../timeline/actions";
import { getActivities, getActivitiyEntries } from "./actions";

type ReturnedActivityEntriesType = Awaited<
  ReturnType<typeof getActivitiyEntries>
>;
type ReturnedActivitiesType = Awaited<ReturnType<typeof getActivities>>;
interface ActivityLogData {
  activityId: string;
  date: Date;
  quantity: number;
  description?: string;
  photo?: File;
}

interface ActivitiesContextType {
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
  deleteActivityEntry: (data: { id: string }) => Promise<string>;
  isDeletingActivity: boolean;
  isDeletingActivityEntry: boolean;

  modifyReactions: (data: {
    activityEntryId: string;
    reactions: { emoji: string; operation: "add" | "remove" }[];
  }) => Promise<void>;
  isModifyingReactions: boolean;

  addComment: (data: {
    activityEntryId: string;
    text: string;
  }) => Promise<void>;
  removeComment: (data: {
    activityEntryId: string;
    commentId: string;
  }) => Promise<void>;
  isAddingComment: boolean;
  isRemovingComment: boolean;

}

const ActivitiesContext = createContext<ActivitiesContextType | undefined>(
  undefined
);

export const ActivitiesProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isSignedIn, isLoaded } = useSession();
  const queryClient = useQueryClient();
  const api = useApiWithAuth();
  const { handleQueryError } = useLogError();

  const activitiesQuery = useQuery({
    queryKey: ["activities"],
    queryFn: async () => {
      try {
        return await getActivities();
      } catch (error) {
        throw error;
      }
    },
    enabled: isSignedIn && isLoaded,
  });
  const activitiesEntriesQuery = useQuery({
    queryKey: ["activity-entries"],
    queryFn: async () => {
      try {
        return await getActivitiyEntries();
      } catch (error) {
        throw error;
      }
    },
    enabled: isSignedIn && isLoaded,
  });

  if (activitiesQuery.error) {
    let customErrorMessage = `Failed to get activities`;
    handleQueryError(activitiesQuery.error, customErrorMessage);
    toast.error(customErrorMessage);
  }

  if (activitiesEntriesQuery.error) {
    let customErrorMessage = `Failed to get activity entries`;
    handleQueryError(activitiesEntriesQuery.error, customErrorMessage);
    toast.error(customErrorMessage);
  }

  const logActivityMutation = useMutation({
    mutationFn: async (data: ActivityLogData) => {
      handleQueryError(new Error("test error"), "test error");
      const formData = new FormData();
      formData.append("activityId", data.activityId);
      formData.append("iso_date_string", data.date.toISOString());
      formData.append("quantity", data.quantity.toString());
      formData.append("description", data.description || "");
      formData.append(
        "timezone",
        Intl.DateTimeFormat().resolvedOptions().timeZone
      );

      if (data.photo) {
        formData.append("photo", data.photo);
      }

      const response = await api.post("/activities/log-activity", formData);
      return response.data;
    },
    onSuccess: (entry, variables) => {
      queryClient.refetchQueries({ queryKey: ["current-user"] });
      queryClient.setQueryData(["activity-entries"], (old: ReturnedActivityEntriesType) => {
        if (!old) return queryClient.refetchQueries({ queryKey: ["activity-entries"] });
        return [...old, entry];
      });
      queryClient.refetchQueries({ queryKey: ["timeline"] });
      queryClient.refetchQueries({ queryKey: ["notifications"] });
      queryClient.refetchQueries({ queryKey: ["metrics"] });

      const hasPhoto = !!variables.photo;
      toast.success(
        hasPhoto
          ? "Activity logged with photo successfully!"
          : "Activity logged successfully!"
      );
    },
    onError: (error) => {
      let customErrorMessage = `Failed to log activity`;
      handleQueryError(error, customErrorMessage);
    },
  });

  const upsertActivityMutation = useMutation({
    mutationFn: async (data: {
      activity: Partial<Activity>;
      muteNotification?: boolean;
    }) => {
      await api.post("/activities/upsert", data.activity);
    },
    onSuccess: (_, { muteNotification }) => {
      queryClient.refetchQueries({ queryKey: ["activities"] });
      queryClient.refetchQueries({ queryKey: ["timeline"] });
      if (!muteNotification) {
        toast.success("Activity updated successfully!");
      }
    },
    onError: (error, { muteNotification }) => {
      let customErrorMessage = `Failed to update activity`;
      handleQueryError(error, customErrorMessage);
      if (!muteNotification) {
        toast.error("Failed to update activity. Please try again.");
      }
    },
  });
  const upsertActivityEntryMutation = useMutation({
    mutationFn: async (data: {
      entry: Partial<ActivityEntry>;
      muteNotification?: boolean;
    }) => {
      await api.put(`/activities/activity-entries/${data.entry.id}`, {
        quantity: Number(data.entry.quantity),
        date: data.entry.date,
        description: data.entry.description || "",
      });
    },
    onSuccess: (_, { muteNotification }) => {
      queryClient.refetchQueries({ queryKey: ["activity-entries"] });
      queryClient.refetchQueries({ queryKey: ["timeline"] });
      if (!muteNotification) {
        toast.success("Activity updated successfully!");
      }
    },
    onError: (error, { muteNotification }) => {
      let customErrorMessage = `Failed to update activity`;
      handleQueryError(error, customErrorMessage);
      if (!muteNotification) {
        toast.error("Failed to update activity. Please try again.");
      }
    },
  });

  const deleteActivityMutation = useMutation({
    mutationFn: async (data: { id: string }) => {
      await api.delete(`/activities/${data.id}`);
      return data.id
    },
    onSuccess: (id) => {
      queryClient.setQueryData(["activities"], (old: ReturnedActivitiesType) => {
        if (!old) return queryClient.refetchQueries({ queryKey: ["activities"] });
        return old.filter((activity) => activity.id !== id);
      });
      queryClient.refetchQueries({ queryKey: ["timeline"] });
      toast.success("Activity deleted successfully!");
    },
    onError: (error) => {
      let customErrorMessage = `Failed to delete activity`;
      handleQueryError(error, customErrorMessage);
      toast.error("Failed to delete activity. Please try again.");
    },
  });
  const deleteActivityEntryMutation = useMutation({
    mutationFn: async (data: { id: string }) => {
      await api.delete(`/activities/activity-entries/${data.id}`);
      return data.id
    },
    onSuccess: (id) => {
      queryClient.setQueryData(["activity-entries"], (old: ReturnedActivityEntriesType) => {
        if (!old) return queryClient.refetchQueries({ queryKey: ["activity-entries"] });
        return old.filter((entry) => entry.id !== id);
      });
      queryClient.setQueryData(["timeline"], (old: TimelineData) => {
        if (!old) return queryClient.refetchQueries({ queryKey: ["timeline"] });
        return { ...old, recommendedActivityEntries: old.recommendedActivityEntries.filter((entry) => entry.id !== id) };
      });
      toast.success("Activity deleted successfully!");
    },
    onError: (error) => {
      let customErrorMessage = `Failed to delete activity entry`;
      handleQueryError(error, customErrorMessage);
      toast.error("Failed to delete activity. Please try again.");
    },
  });

  const modifyReactionsMutation = useMutation({
    mutationFn: async (data: {
      activityEntryId: string;
      reactions: { emoji: string; operation: "add" | "remove" }[];
    }) => {
      const response = await api.post(
        `/activities/activity-entries/${data.activityEntryId}/modify-reactions`,
        {
          reactions: data.reactions,
        }
      );
      return response.data.reactions;
    },
    onSuccess: (reactions, input) => {
      queryClient.setQueryData(
        ["activity-entries"],
        (old: ReturnedActivityEntriesType) => {
          return old.map((entry) => {
            return entry.id === input.activityEntryId
              ? { ...entry, reactions: reactions }
              : entry;
          });
        }
      );

      queryClient.setQueryData(["timeline"], (old: TimelineData) => {
        if (!old) return queryClient.refetchQueries({ queryKey: ["timeline"] });
        return {
          ...old,
          recommendedActivityEntries: old.recommendedActivityEntries.map((entry) => {
            return entry.id === input.activityEntryId
              ? { ...entry, reactions: reactions }
              : entry;
          }),
        };
      });
    },
    onError: (error) => {
      let customErrorMessage = `Failed to modify reactions`;
      handleQueryError(error, customErrorMessage);
      toast.error("Failed to modify reactions. Please try again.");
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async (data: {
      activityEntryId: string;
      text: string;
    }) => {
      const response = await api.post(
        `/activities/activity-entries/${data.activityEntryId}/comments`,
        { text: data.text }
      );
      return response.data.comments;
    },
    onSuccess: (comments, input) => {
      queryClient.setQueryData(["timeline"], (old: TimelineData) => {
        if (!old) return queryClient.refetchQueries({ queryKey: ["timeline"] });
        return {
          ...old,
          recommendedActivityEntries: old.recommendedActivityEntries.map((entry) => {
            return entry.id === input.activityEntryId
              ? { ...entry, comments: comments }
              : entry;
          }),
        };
      });
    },
    onError: (error) => {
      let customErrorMessage = `Failed to add comment`;
      handleQueryError(error, customErrorMessage);
      toast.error("Failed to add comment. Please try again.");
    },
  });

  const removeCommentMutation = useMutation({
    mutationFn: async (data: {
      activityEntryId: string;
      commentId: string;
    }) => {
      const response = await api.delete(
        `/activities/activity-entries/${data.activityEntryId}/comments/${data.commentId}`
      );
      return response.data.comments;
    },
    onSuccess: (comments, input) => {
      queryClient.setQueryData(["timeline"], (old: TimelineData) => {
        if (!old) return queryClient.refetchQueries({ queryKey: ["timeline"] });
        return {
          ...old,
          recommendedActivityEntries: old.recommendedActivityEntries.map((entry) => {
            return entry.id === input.activityEntryId
              ? { ...entry, comments: comments }
              : entry;
          }),
        };
      });
    },
    onError: (error) => {
      let customErrorMessage = `Failed to remove comment`;
      handleQueryError(error, customErrorMessage);
      toast.error("Failed to remove comment. Please try again.");
    },
  });


  const context: ActivitiesContextType = {
    activities: activitiesQuery.data || [],
    activityEntries: activitiesEntriesQuery.data || [],
    isLoadingActivities: activitiesQuery.isLoading,
    isLoadingActivityEntries: activitiesEntriesQuery.isLoading,

    logActivity: logActivityMutation.mutateAsync,
    isLoggingActivity: logActivityMutation.isPending,

    upsertActivity: upsertActivityMutation.mutateAsync,
    isUpsertingActivity: upsertActivityMutation.isPending,
    upsertActivityEntry: upsertActivityEntryMutation.mutateAsync,
    isUpsertingActivityEntry: upsertActivityEntryMutation.isPending,

    deleteActivity: deleteActivityMutation.mutateAsync,
    isDeletingActivity: deleteActivityMutation.isPending,
    deleteActivityEntry: deleteActivityEntryMutation.mutateAsync,
    isDeletingActivityEntry: deleteActivityEntryMutation.isPending,

    modifyReactions: modifyReactionsMutation.mutateAsync,
    isModifyingReactions: modifyReactionsMutation.isPending,

    addComment: addCommentMutation.mutateAsync,
    removeComment: removeCommentMutation.mutateAsync,
    isAddingComment: addCommentMutation.isPending,
    isRemovingComment: removeCommentMutation.isPending,

  };

  return (
    <ActivitiesContext.Provider value={context}>
      {children}
    </ActivitiesContext.Provider>
  );
};

export const useActivities = () => {
  const context = useContext(ActivitiesContext);
  if (context === undefined) {
    throw new Error("useActivities must be used within an ActivitiesProvider");
  }
  return context;
};
