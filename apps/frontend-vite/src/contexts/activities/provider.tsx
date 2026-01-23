
import { useApiWithAuth } from "@/api";
import { useSession } from "@/contexts/auth";
import { useLogError } from "@/hooks/useLogError";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type Activity, type ActivityEntry } from "@tsw/prisma";
import React from "react";
import { toast } from "react-hot-toast";
import { type TimelineData } from "../timeline/service";
import { type HydratedUser } from "../users/service";
import { getActivities, getActivitiyEntries, deleteAchievementPost } from "./service";
import {
  ActivitiesContext,
  type ActivitiesContextType,
  type ActivityLogData,
  type ReturnedActivitiesType,
  type ReturnedActivityEntriesType,
} from "./types";

export const ActivitiesProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isSignedIn, isLoaded } = useSession();
  const queryClient = useQueryClient();
  const api = useApiWithAuth();
  const { handleQueryError } = useLogError();

  const activitiesQuery = useQuery({
    queryKey: ["activities"],
    queryFn: () => getActivities(api),
    enabled: isSignedIn && isLoaded,
  });
  const activitiesEntriesQuery = useQuery({
    queryKey: ["activity-entries"],
    queryFn: () => getActivitiyEntries(api),
    enabled: isSignedIn && isLoaded,
  });

  if (activitiesQuery.error) {
    const customErrorMessage = `Failed to get activities`;
    handleQueryError(activitiesQuery.error, customErrorMessage);
    toast.error(customErrorMessage);
  }

  if (activitiesEntriesQuery.error) {
    const customErrorMessage = `Failed to get activity entries`;
    handleQueryError(activitiesEntriesQuery.error, customErrorMessage);
    toast.error(customErrorMessage);
  }

  const logActivityMutation = useMutation({
    mutationFn: async (data: ActivityLogData) => {
      const formData = new FormData();
      formData.append("activityId", data.activityId);
      formData.append("iso_date_string", data.datetime.toISOString());
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
    onSuccess: async (entry, variables) => {
      queryClient.refetchQueries({ queryKey: ["current-user"] });
      queryClient.setQueryData(
        ["activity-entries"],
        (old: ReturnedActivityEntriesType) => {
          if (!old || !Array.isArray(old)) {
            queryClient.refetchQueries({ queryKey: ["activity-entries"] });
            return old;
          }
          return [...old, entry];
        }
      );
      queryClient.invalidateQueries({ queryKey: ["activity-entries"] });
      queryClient.invalidateQueries({ queryKey: ["timeline"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["metrics"] });
      queryClient.invalidateQueries({ queryKey: ["plan-group-progress"] });

      // Refetch plans and WAIT for it - this ensures fresh progress data
      // is available for achievement detection
      await queryClient.refetchQueries({ queryKey: ["plans"] });

      const hasPhoto = !!variables.photo;
      toast.success(
        hasPhoto
          ? "Activity logged with photo successfully!"
          : "Activity logged successfully!"
      );
    },
    onError: (error) => {
      const customErrorMessage = `Failed to log activity`;
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
    onSuccess: (_, { activity: newActivity, muteNotification }) => {
      queryClient.setQueryData(
        ["activities"],
        (old: ReturnedActivitiesType) => {
          if (!old)
            return queryClient.refetchQueries({ queryKey: ["activities"] });
          return old.map((a) => {
            return newActivity.id === a.id ? { ...a, ...newActivity } : a;
          });
        }
      );
      queryClient.refetchQueries({ queryKey: ["activities"] });
      queryClient.refetchQueries({ queryKey: ["timeline"] });
      if (!muteNotification) {
        toast.success("Activity updated successfully!");
      }
    },
    onError: (error, { muteNotification }) => {
      const customErrorMessage = `Failed to update activity`;
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
      const payload: Record<string, unknown> = {};
      if (data.entry.quantity !== undefined)
        payload.quantity = Number(data.entry.quantity);
      if (data.entry.datetime !== undefined)
        payload.datetime = data.entry.datetime;
      if (data.entry.description !== undefined)
        payload.description = data.entry.description;
      if ((data.entry as any).difficulty !== undefined)
        payload.difficulty = (data.entry as any).difficulty;

      await api.put(`/activities/activity-entries/${data.entry.id}`, payload);
    },
    onSuccess: async (_, { muteNotification }) => {
      queryClient.refetchQueries({ queryKey: ["activity-entries"] });
      queryClient.refetchQueries({ queryKey: ["timeline"] });

      // Refetch plans to update progress after entry update
      await queryClient.refetchQueries({ queryKey: ["plans"] });

      if (!muteNotification) {
        toast.success("Activity updated successfully!");
      }
    },
    onError: (error, { muteNotification }) => {
      const customErrorMessage = `Failed to update activity`;
      handleQueryError(error, customErrorMessage);
      if (!muteNotification) {
        toast.error("Failed to update activity. Please try again.");
      }
    },
  });

  const deleteActivityMutation = useMutation({
    mutationFn: async (data: { id: string }) => {
      await api.delete(`/activities/${data.id}`);
      return data.id;
    },
    onSuccess: async (id) => {
      queryClient.setQueryData(
        ["activities"],
        (old: ReturnedActivitiesType) => {
          if (!old)
            return queryClient.refetchQueries({ queryKey: ["activities"] });
          return old.filter((activity) => activity.id !== id);
        }
      );
      queryClient.refetchQueries({ queryKey: ["timeline"] });

      // Refetch plans to update progress after activity deletion
      await queryClient.refetchQueries({ queryKey: ["plans"] });

      toast.success("Activity deleted successfully!");
    },
    onError: (error) => {
      const customErrorMessage = `Failed to delete activity`;
      handleQueryError(error, customErrorMessage);
      toast.error("Failed to delete activity. Please try again.");
    },
  });
  const deleteActivityEntryMutation = useMutation({
    mutationFn: async (data: { id: string; activityId: string }) => {
      await api.delete(`/activities/activity-entries/${data.id}`);
      return data;
    },
    onSuccess: async ({ id }) => {
      queryClient.setQueryData(
        ["activity-entries"],
        (old: ReturnedActivityEntriesType) => {
          if (!old)
            return queryClient.refetchQueries({
              queryKey: ["activity-entries"],
            });
          return old.filter((entry) => entry.id !== id);
        }
      );
      queryClient.setQueryData(["timeline"], (old: TimelineData) => {
        if (!old) return queryClient.refetchQueries({ queryKey: ["timeline"] });
        return {
          ...old,
          recommendedActivityEntries: old.recommendedActivityEntries.filter(
            (entry) => entry.id !== id
          ),
        };
      });

      // Refetch plans to update progress after entry deletion
      await queryClient.refetchQueries({ queryKey: ["plans"] });

      toast.success("Activity deleted successfully!");
    },
    onError: (error) => {
      const customErrorMessage = `Failed to delete activity entry`;
      handleQueryError(error, customErrorMessage);
      toast.error("Failed to delete activity. Please try again.");
    },
  });

  const modifyReactionsMutation = useMutation({
    mutationFn: async (data: {
      activityEntryId: string;
      userUsername: string;
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
          recommendedActivityEntries: old.recommendedActivityEntries.map(
            (entry) => {
              return entry.id === input.activityEntryId
                ? { ...entry, reactions: reactions }
                : entry;
            }
          ),
        };
      });
      queryClient.setQueryData(
        ["user", input.userUsername],
        (old: HydratedUser) => {
          if (!old)
            return queryClient.refetchQueries({
              queryKey: ["user", input.userUsername],
            });
          return {
            ...old,
            activityEntries: old.activityEntries?.map((entry) => {
              return entry.id === input.activityEntryId
                ? { ...entry, reactions: reactions }
                : entry;
            }),
          };
        }
      );
    },
    onError: (error) => {
      const customErrorMessage = `Failed to modify reactions`;
      handleQueryError(error, customErrorMessage);
      toast.error("Failed to modify reactions. Please try again.");
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async (data: {
      activityEntryId: string;
      userUsername: string;
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
          recommendedActivityEntries: old.recommendedActivityEntries?.map(
            (entry) => {
              return entry.id === input.activityEntryId
                ? { ...entry, comments: comments }
                : entry;
            }
          ),
        };
      });
      queryClient.setQueryData(
        ["user", input.userUsername],
        (old: HydratedUser) => {
          if (!old)
            return queryClient.refetchQueries({
              queryKey: ["user", input.userUsername],
            });
          return {
            ...old,
            activityEntries: old.activityEntries?.map((entry) => {
              return entry.id === input.activityEntryId
                ? { ...entry, comments: comments }
                : entry;
            }),
          };
        }
      );
    },
    onError: (error) => {
      const customErrorMessage = `Failed to add comment`;
      handleQueryError(error, customErrorMessage);
      toast.error("Failed to add comment. Please try again.");
    },
  });

  const removeCommentMutation = useMutation({
    mutationFn: async (data: {
      activityEntryId: string;
      userUsername: string;
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
          recommendedActivityEntries: old.recommendedActivityEntries.map(
            (entry) => {
              return entry.id === input.activityEntryId
                ? { ...entry, comments: comments }
                : entry;
            }
          ),
        };
      });
      queryClient.setQueryData(
        ["user", input.userUsername],
        (old: HydratedUser) => {
          if (!old)
            return queryClient.refetchQueries({
              queryKey: ["user", input.userUsername],
            });
          return {
            ...old,
            activityEntries: old.activityEntries?.map((entry) => {
              return entry.id === input.activityEntryId
                ? { ...entry, comments: comments }
                : entry;
            }),
          };
        }
      );
    },
    onError: (error) => {
      const customErrorMessage = `Failed to remove comment`;
      handleQueryError(error, customErrorMessage);
      toast.error("Failed to remove comment. Please try again.");
    },
  });

  // Achievement post reactions
  const modifyReactionsOnAchievementMutation = useMutation({
    mutationFn: async (data: {
      achievementPostId: string;
      userUsername: string;
      reactions: { emoji: string; operation: "add" | "remove" }[];
    }) => {
      const response = await api.post(
        `/achievements/${data.achievementPostId}/modify-reactions`,
        {
          reactions: data.reactions,
        }
      );
      return response.data.reactions;
    },
    onSuccess: (reactions, input) => {
      queryClient.setQueryData(["timeline"], (old: TimelineData) => {
        if (!old) return queryClient.refetchQueries({ queryKey: ["timeline"] });
        return {
          ...old,
          achievementPosts: old.achievementPosts?.map((post) => {
            return post.id === input.achievementPostId
              ? { ...post, reactions: reactions }
              : post;
          }),
        };
      });
      queryClient.setQueryData(
        ["user", input.userUsername],
        (old: HydratedUser) => {
          if (!old)
            return queryClient.refetchQueries({
              queryKey: ["user", input.userUsername],
            });
          return {
            ...old,
            achievementPosts: old.achievementPosts?.map((post) => {
              return post.id === input.achievementPostId
                ? { ...post, reactions: reactions }
                : post;
            }),
          };
        }
      );
    },
    onError: (error) => {
      const customErrorMessage = `Failed to update reactions`;
      handleQueryError(error, customErrorMessage);
      toast.error("Failed to update reactions. Please try again.");
    },
  });

  // Achievement post comments
  const addCommentToAchievementMutation = useMutation({
    mutationFn: async (data: {
      achievementPostId: string;
      userUsername: string;
      text: string;
    }) => {
      const response = await api.post(
        `/achievements/${data.achievementPostId}/comments`,
        { text: data.text }
      );
      return response.data.comments;
    },
    onSuccess: (comments, input) => {
      queryClient.setQueryData(["timeline"], (old: TimelineData) => {
        if (!old) return queryClient.refetchQueries({ queryKey: ["timeline"] });
        return {
          ...old,
          achievementPosts: old.achievementPosts?.map((post) => {
            return post.id === input.achievementPostId
              ? { ...post, comments: comments }
              : post;
          }),
        };
      });
      queryClient.setQueryData(
        ["user", input.userUsername],
        (old: HydratedUser) => {
          if (!old)
            return queryClient.refetchQueries({
              queryKey: ["user", input.userUsername],
            });
          return {
            ...old,
            achievementPosts: old.achievementPosts?.map((post) => {
              return post.id === input.achievementPostId
                ? { ...post, comments: comments }
                : post;
            }),
          };
        }
      );
    },
    onError: (error) => {
      const customErrorMessage = `Failed to add comment`;
      handleQueryError(error, customErrorMessage);
      toast.error("Failed to add comment. Please try again.");
    },
  });

  const removeCommentFromAchievementMutation = useMutation({
    mutationFn: async (data: {
      achievementPostId: string;
      userUsername: string;
      commentId: string;
    }) => {
      const response = await api.delete(
        `/achievements/${data.achievementPostId}/comments/${data.commentId}`
      );
      return response.data.comments;
    },
    onSuccess: (comments, input) => {
      queryClient.setQueryData(["timeline"], (old: TimelineData) => {
        if (!old) return queryClient.refetchQueries({ queryKey: ["timeline"] });
        return {
          ...old,
          achievementPosts: old.achievementPosts?.map((post) => {
            return post.id === input.achievementPostId
              ? { ...post, comments: comments }
              : post;
          }),
        };
      });
      queryClient.setQueryData(
        ["user", input.userUsername],
        (old: HydratedUser) => {
          if (!old)
            return queryClient.refetchQueries({
              queryKey: ["user", input.userUsername],
            });
          return {
            ...old,
            achievementPosts: old.achievementPosts?.map((post) => {
              return post.id === input.achievementPostId
                ? { ...post, comments: comments }
                : post;
            }),
          };
        }
      );
    },
    onError: (error) => {
      const customErrorMessage = `Failed to remove comment`;
      handleQueryError(error, customErrorMessage);
      toast.error("Failed to remove comment. Please try again.");
    },
  });

  const deleteAchievementPostMutation = useMutation({
    mutationFn: async (data: {
      achievementPostId: string;
      userUsername: string;
    }) => {
      await deleteAchievementPost(api, data.achievementPostId);
    },
    onSuccess: (_, input) => {
      // Remove from timeline data
      queryClient.setQueryData(["timeline"], (old: TimelineData) => {
        if (!old) return queryClient.refetchQueries({ queryKey: ["timeline"] });
        return {
          ...old,
          achievementPosts: old.achievementPosts?.filter(
            (post) => post.id !== input.achievementPostId
          ),
        };
      });
      // Remove from user data
      queryClient.setQueryData(
        ["user", input.userUsername],
        (old: HydratedUser) => {
          if (!old)
            return queryClient.refetchQueries({
              queryKey: ["user", input.userUsername],
            });
          return {
            ...old,
            achievementPosts: old.achievementPosts?.filter(
              (post) => post.id !== input.achievementPostId
            ),
          };
        }
      );
      toast.success("Achievement post deleted successfully");
    },
    onError: (error) => {
      const customErrorMessage = `Failed to delete achievement post`;
      handleQueryError(error, customErrorMessage);
      toast.error("Failed to delete achievement post. Please try again.");
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

    modifyReactionsOnAchievement: modifyReactionsOnAchievementMutation.mutateAsync,
    addCommentToAchievement: addCommentToAchievementMutation.mutateAsync,
    removeCommentFromAchievement: removeCommentFromAchievementMutation.mutateAsync,
    deleteAchievementPost: deleteAchievementPostMutation.mutateAsync,
    isDeletingAchievementPost: deleteAchievementPostMutation.isPending,
  };

  return (
    <ActivitiesContext.Provider value={context}>
      {children}
    </ActivitiesContext.Provider>
  );
};
