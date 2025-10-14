
import { useApiWithAuth } from "@/api";
import { useAuth, useSession } from "@/contexts/auth";
import { useLogError } from "@/hooks/useLogError";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Prisma } from "@tsw/prisma";
import React, {
  useCallback,
  useEffect
} from "react";
import { toast } from "react-hot-toast";
import {
  deleteAccount as deleteAccountService,
  getCurrentUserBasicData,
  type HydratedCurrentUser,
  type HydratedUser,
  updateUser as updateUserService,
} from "./service";
import { UsersContext, type UsersContextType } from "./types";

export const UsersProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isSignedIn, isLoaded } = useSession();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const queryClient = useQueryClient();
  const api = useApiWithAuth();
  const { handleQueryError } = useLogError();

  const handleAuthError = useCallback(
    (err?: unknown) => {
      console.error("[UsersProvider] Auth error:", err);
      navigate({ to: "/signin", search: { redirect_url: undefined } });
      toast.error(
        "You are not authorized to access this page. Please login again.",
        {
          icon: "🔒",
          duration: 5000,
        }
      );
      queryClient.clear();
      signOut();
      throw err;
    },
    [navigate, queryClient, signOut]
  );

  const currentUserQuery = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      console.log("fetching user")
      const result = await getCurrentUserBasicData(api);
      return result
    },
    enabled: isLoaded && isSignedIn,
    retry: 5,
    retryDelay: 1000,
  });

  useEffect(() => {
    if (currentUserQuery.error) {
      handleAuthError("could not load current user");
      handleQueryError(currentUserQuery.error, `Failed to get current user`);
    }
  }, [currentUserQuery.error, handleAuthError, handleQueryError]);

  const updateUserMutation = useMutation({
    mutationFn: async (data: {
      updates: Prisma.UserUpdateInput;
      muteNotifications?: boolean;
    }) => {
      return await updateUserService(api, data.updates);
    },
    onSuccess: (updatedUser, { muteNotifications }) => {
      queryClient.setQueryData(["current-user"], updatedUser);
      if (updatedUser?.username) {
        queryClient.setQueryData(["user", updatedUser.username], updatedUser as HydratedUser);
      }
      if (!muteNotifications) {
        toast.success("User updated successfully");
      }
    },
    onError: (error, { muteNotifications }) => {
      console.error("Error updating user:", error);
      if (!muteNotifications) {
        toast.error("Failed to update user");
      }
    },
  });

  const updateProfileImageMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("image", file);

      const response = await api.post("/users/update-profile-image", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      return response.data.url as string;
    },
    onSuccess: (publicUrl) => {
      // Update the current user's picture in the cache
      queryClient.setQueryData(["current-user"], (old: HydratedCurrentUser) => {
        if (!old) return old;
        return { ...old, picture: publicUrl };
      });

      // Also update in the user cache if username exists
      const currentUser = queryClient.getQueryData<HydratedCurrentUser>(["current-user"]);
      if (currentUser?.username) {
        queryClient.setQueryData(["user", currentUser.username], (old: HydratedUser) => {
          if (!old) return old;
          return { ...old, picture: publicUrl };
        });
      }

      toast.success("Profile picture updated");
    },
    onError: (error) => {
      console.error("Error updating profile image:", error);
      toast.error("Failed to update profile picture");
    },
  });

  const sendFriendRequestMutation = useMutation({
    mutationFn: async (userId: string) => {
      await api.post(`/users/send-connection-request/${userId}`);
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["current-user"] });
      toast.success("Friend request sent successfully");
    },
    onError: (error) => {
      console.error("Error sending friend request:", error);
      toast.error("Failed to send friend request");
    },
  });

  const acceptFriendRequestMutation = useMutation({
    mutationFn: async (user: { id: string, username: string }) => {
      const response = await api.post(
        `/users/accept-connection-request/${user.id}`
      );
      return response.data.connection;
    },
    onSuccess: (newConnection, user) => {
      queryClient.setQueryData(["current-user"], (old: HydratedCurrentUser) => {
        if (!old)
          return queryClient.refetchQueries({ queryKey: ["current-user"] });
        // replace the connection of id into the connectionsTo array
        return {
          ...old,
          connectionsTo: old.connectionsTo?.map((oldConnection) =>
            newConnection.id === oldConnection.id ? newConnection : oldConnection
          ),
        };
      });
      queryClient.setQueryData(["user", user.username], (old: HydratedUser) => {
        if (!old)
          return queryClient.refetchQueries({ queryKey: ["users", user.username] });
        return {
          ...old,
          connectionsFrom: old.connectionsFrom?.map((oldConnection) =>
            newConnection.id === oldConnection.id ? newConnection : oldConnection
          ),
        };
      });
      queryClient.refetchQueries({ queryKey: ["notifications"] });
      queryClient.refetchQueries({ queryKey: ["timeline"] });
      toast.success("Friend request accepted!");
    },
    onError: (error) => {
      console.error("Error accepting friend request:", error);
      toast.error("Failed to accept friend request.");
    },
  });

  const rejectFriendRequestMutation = useMutation({
    mutationFn: async (user: { id: string, username: string }) => {
      const repsonse = await api.post(
        `/users/reject-connection-request/${user.id}`
      );
      return repsonse.data.connection;
    },
    onSuccess: (newConnection, user) => {
      queryClient.setQueryData(["current-user"], (old: HydratedCurrentUser) => {
        if (!old)
          return queryClient.refetchQueries({ queryKey: ["current-user"] });
        return {
          ...old,
          connectionsTo: old.connectionsTo?.map((oldConnection) =>
            newConnection.id === oldConnection.id ? newConnection : oldConnection
          ),
        };
      });
      queryClient.setQueryData(["user", user.username], (old: HydratedUser) => {
        if (!old)
          return queryClient.refetchQueries({ queryKey: ["user", user.username] });
        return {
          ...old,
          connectionsFrom: old.connectionsFrom?.map((oldConnection) =>
            newConnection.id === oldConnection.id ? newConnection : oldConnection
          ),
        };
      });
      queryClient.refetchQueries({ queryKey: ["notifications"] });
      toast.success("Friend request rejected.");
    },
    onError: (error) => {
      console.error("Error rejecting friend request:", error);
      toast.error("Failed to reject friend request.");
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      await deleteAccountService(api);
    },
    onSuccess: async () => {
      queryClient.clear();
      await signOut();
      toast.success("Account deleted successfully");
      navigate({ to: "/signin" });
    },
    onError: (error) => {
      console.error("Error deleting account:", error);
      toast.error("Failed to delete account");
    },
  });

  const refetchCurrentUser = useCallback(
    async (notify = true) => {
      await queryClient.refetchQueries({ queryKey: ["current-user"] });
      if (notify) {
        toast.success("User data refreshed");
      }
    },
    [queryClient]
  );

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      console.log("🧹 Clearing users cache because not signed in");
      queryClient.clear();
      if (typeof window !== "undefined") {
        localStorage.removeItem("TRACKING_SO_QUERY_CACHE");
      }
    }
  }, [isSignedIn, isLoaded, queryClient]);

  const context: UsersContextType = {
    currentUser: currentUserQuery.data,
    isLoadingCurrentUser: currentUserQuery.isLoading,
    currentUserError: currentUserQuery.error,
    refetchCurrentUser,
    hasLoadedUserData: currentUserQuery.isSuccess && !!currentUserQuery.data,
    handleAuthError,
    // Actions
    updateUser: updateUserMutation.mutateAsync,
    isUpdatingUser: updateUserMutation.isPending,

    updateProfileImage: updateProfileImageMutation.mutateAsync,
    isUpdatingProfileImage: updateProfileImageMutation.isPending,

    sendFriendRequest: sendFriendRequestMutation.mutateAsync,
    isSendingFriendRequest: sendFriendRequestMutation.isPending,

    acceptFriendRequest: acceptFriendRequestMutation.mutateAsync,
    isAcceptingFriendRequest: acceptFriendRequestMutation.isPending,

    rejectFriendRequest: rejectFriendRequestMutation.mutateAsync,
    isRejectingFriendRequest: rejectFriendRequestMutation.isPending,

    deleteAccount: deleteAccountMutation.mutateAsync,
    isDeletingAccount: deleteAccountMutation.isPending,
  };

  return (
    <UsersContext.Provider value={context}>{children}</UsersContext.Provider>
  );
};