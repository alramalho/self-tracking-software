"use client";

import { useApiWithAuth } from "@/api";
import { useSession } from "@clerk/clerk-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, ActivityEntry } from "@tsw/prisma";
import React, { createContext, useContext } from "react";
import { toast } from "react-hot-toast";
import { getActivities, getActivitiyEntries } from "./actions";

type ReturnedActivityEntriesType = Awaited<ReturnType<typeof getActivitiyEntries>>;
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

  upsertActivity: (data: Partial<Activity>) => Promise<void>;
  upsertActivityEntry: (data: Partial<ActivityEntry>) => Promise<void>;
  isUpsertingActivityEntry: boolean;
  isUpsertingActivity: boolean;

  deleteActivity: (data: { id: string }) => Promise<void>;
  deleteActivityEntry: (data: { id: string }) => Promise<void>;
  isDeletingActivity: boolean;
  isDeletingActivityEntry: boolean;
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

  const logActivityMutation = useMutation({
    mutationFn: async (data: ActivityLogData) => {
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

      await api.post("/activities/log-activity", formData);
    },
    onSuccess: (_, variables) => {
      queryClient.refetchQueries({ queryKey: ["current-user"] });
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
      console.error("Error logging activity:", error);
      toast.error("Failed to log activity. Please try again.");
    },
  });

  const upsertActivityMutation = useMutation({
    mutationFn: async (data: Partial<Activity>) => {
      await api.post("/activities/upsert", data);
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["activities"] });
      queryClient.refetchQueries({ queryKey: ["timeline"] });
      toast.success("Activity updated successfully!");
    },
    onError: (error) => {
      console.error("Error updating activity:", error);
      toast.error("Failed to update activity. Please try again.");
    },
  });
  const upsertActivityEntryMutation = useMutation({
    mutationFn: async (data: Partial<ActivityEntry>) => {
      await api.put(`/activities/activity-entries/${data.id}`, {
        quantity: Number(data.quantity),
        date: data.date,
        description: data.description || "",
      });
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["activity-entries"] });
      queryClient.refetchQueries({ queryKey: ["timeline"] });
      toast.success("Activity updated successfully!");
    },
    onError: (error) => {
      console.error("Error updating activity:", error);
      toast.error("Failed to update activity. Please try again.");
    },
  });

  const deleteActivityMutation = useMutation({
    mutationFn: async (data: { id: string }) => {
      await api.delete(`/activities/${data.id}`);
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["activities"] });
      queryClient.refetchQueries({ queryKey: ["timeline"] });
      toast.success("Activity deleted successfully!");
    },
    onError: (error) => {
      console.error("Error deleting activity:", error);
      toast.error("Failed to delete activity. Please try again.");
    },
  });
  const deleteActivityEntryMutation = useMutation({
    mutationFn: async (data: { id: string }) => {
      await api.delete(`/activities/activity-entries/${data.id}`);
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["activities"] });
      queryClient.refetchQueries({ queryKey: ["timeline"] });
      toast.success("Activity deleted successfully!");
    },
    onError: (error) => {
      console.error("Error deleting activity:", error);
      toast.error("Failed to delete activity. Please try again.");
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
