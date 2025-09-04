"use client";

import { useApiWithAuth } from "@/api";
import { useSession } from "@clerk/clerk-react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Notification } from "@tsw/prisma";
import React, {
  createContext,
  useContext,
} from "react";
import { toast } from "react-hot-toast";
import { getNotifications } from "./actions";

interface DataNotificationsContextType {
  // Data access
  notifications: Notification[] | undefined;
  isLoadingNotifications: boolean;
  notificationsError: Error | null;
  
  // Actions
  concludeNotification: (notificationId: string) => Promise<void>;
  isConcludingNotification: boolean;
  
  acceptFriendRequest: (notificationId: string) => Promise<void>;
  isAcceptingFriendRequest: boolean;
  
  rejectFriendRequest: (notificationId: string) => Promise<void>;
  isRejectingFriendRequest: boolean;
  
  clearAllNotifications: () => Promise<void>;
  isClearingNotifications: boolean;
  
}

const DataNotificationsContext = createContext<DataNotificationsContextType | undefined>(undefined);

export const DataNotificationsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isSignedIn, isLoaded } = useSession();
  const queryClient = useQueryClient();
  const api = useApiWithAuth();

  // Notifications query
  const notificationsQuery = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      try {
        return await getNotifications();
      } catch (err) {
        console.error("[DataNotificationsProvider] Error fetching notifications:", err);
        throw err;
      }
    },
    enabled: !!isSignedIn && isLoaded,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  const concludeNotificationMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      await api.post(`/notifications/conclude/${notificationId}`);
    },
    onSuccess: () => {
      toast.success("Notification concluded!");
      queryClient.refetchQueries({ queryKey: ["notifications"] });
    },
    onError: (error) => {
      console.error("Error concluding notification:", error);
      toast.error("Failed to update notification.");
    },
  });

  // Accept friend request mutation
  const acceptFriendRequestMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      await api.post(`/notifications/accept-friend-request/${notificationId}`);
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["notifications"] });
      queryClient.refetchQueries({ queryKey: ["user", "current"] });
      toast.success("Friend request accepted!");
    },
    onError: (error) => {
      console.error("Error accepting friend request:", error);
      toast.error("Failed to accept friend request.");
    },
  });

  // Reject friend request mutation
  const rejectFriendRequestMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      await api.post(`/notifications/reject-friend-request/${notificationId}`);
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["notifications"] });
      toast.success("Friend request rejected.");
    },
    onError: (error) => {
      console.error("Error rejecting friend request:", error);
      toast.error("Failed to reject friend request.");
    },
  });

  // Clear all notifications mutation
  const clearAllNotificationsMutation = useMutation({
    mutationFn: async () => {
      await api.post("/notifications/clear-all-notifications");
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["notifications"] });
      toast.success("All notifications cleared!");
    },
    onError: (error) => {
      console.error("Error clearing notifications:", error);
      toast.error("Failed to clear notifications.");
    },
  });

  const context: DataNotificationsContextType = {
    // Data access
    notifications: notificationsQuery.data,
    isLoadingNotifications: notificationsQuery.isLoading,
    notificationsError: notificationsQuery.error,
    
    // Actions
    concludeNotification: concludeNotificationMutation.mutateAsync,
    isConcludingNotification: concludeNotificationMutation.isPending,
    
    acceptFriendRequest: acceptFriendRequestMutation.mutateAsync,
    isAcceptingFriendRequest: acceptFriendRequestMutation.isPending,
    
    rejectFriendRequest: rejectFriendRequestMutation.mutateAsync,
    isRejectingFriendRequest: rejectFriendRequestMutation.isPending,
    
    clearAllNotifications: clearAllNotificationsMutation.mutateAsync,
    isClearingNotifications: clearAllNotificationsMutation.isPending,
  };

  return (
    <DataNotificationsContext.Provider value={context}>
      {children}
    </DataNotificationsContext.Provider>
  );
};

export const useDataNotifications = () => {
  const context = useContext(DataNotificationsContext);
  if (context === undefined) {
    throw new Error("useDataNotifications must be used within a DataNotificationsProvider");
  }
  return context;
};