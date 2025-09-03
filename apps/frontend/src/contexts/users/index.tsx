"use client";

import { useApiWithAuth } from "@/api";
import { useSession } from "@clerk/clerk-react";
import { useClerk } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Prisma, User } from "@tsw/prisma";
import { useRouter } from "next/navigation";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
} from "react";
import { toast } from "react-hot-toast";
import {
  getCurrentUserBasicData,
  getUserBasicDataByUserNameOrId,
  HydratedCurrentUser,
  updateUser as updateUserAction,
} from "./actions";

export type ThemeColorType =
  | "blue"
  | "violet"
  | "emerald"
  | "rose"
  | "amber"
  | "slate"
  | "random";

interface UsersContextType {
  // Current user data
  currentUser: HydratedCurrentUser | undefined;
  isLoadingCurrentUser: boolean;
  currentUserError: Error | null;

  // Data management
  refetchCurrentUser: (notify?: boolean) => Promise<void>;
  hasLoadedUserData: boolean;

  // Auth helpers
  handleAuthError: (err: unknown) => void;
  // Actions
  updateUser: (data: Prisma.UserUpdateInput) => Promise<User>;
  isUpdatingUser: boolean;

  sendFriendRequest: (userId: string) => Promise<void>;
  isSendingFriendRequest: boolean;

  acceptFriendRequest: (requestId: string) => Promise<void>;
  isAcceptingFriendRequest: boolean;

  rejectFriendRequest: (requestId: string) => Promise<void>;
  isRejectingFriendRequest: boolean;
}

const UsersContext = createContext<UsersContextType | undefined>(undefined);

export const UsersProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isSignedIn, isLoaded } = useSession();
  const router = useRouter();
  const { signOut } = useClerk();
  const queryClient = useQueryClient();
  const api = useApiWithAuth();

  const currentUserQuery = useQuery({
    queryKey: ["current-user"],
    queryFn: getCurrentUserBasicData,
    enabled: isLoaded && isSignedIn,
  });

  const updateUserMutation = useMutation({
    mutationFn: updateUserAction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
      toast.success("User updated successfully");
    },
    onError: (error) => {
      console.error("Error updating user:", error);
      toast.error("Failed to update user");
    },
  });

  const sendFriendRequestMutation = useMutation({
    mutationFn: async (userId: string) => {
      await api.post(`/users/send-connection-request/${userId}`);
    },
    onSuccess: () => {
      toast.success("Friend request sent successfully");
    },
    onError: (error) => {
      console.error("Error sending friend request:", error);
      toast.error("Failed to send friend request");
    },
  });

  const acceptFriendRequestMutation = useMutation({
    mutationFn: async (userId: string) => {
      await api.post(`/users/accept-connection-request/${userId}`);
    },
    onSuccess: () => {
      toast.success("Friend request accepted successfully");
    },
  });

  const rejectFriendRequestMutation = useMutation({
    mutationFn: async (userId: string) => {
      await api.post(`/users/reject-connection-request/${userId}`);
    },
    onSuccess: () => {
      toast.success("Friend request rejected successfully");
    },
  });

  const handleAuthError = useCallback(
    (err: unknown) => {
      console.error("[UsersProvider] Auth error:", err);
      router.push("/signin");
      toast.error(
        "You are not authorized to access this page. Please login again.",
        {
          icon: "🔒",
          duration: 5000,
        }
      );
      queryClient.clear();
      signOut({ redirectUrl: window.location.pathname });
      throw err;
    },
    [router, queryClient, signOut]
  );

  const refetchCurrentUser = useCallback(
    async (notify = true) => {
      await queryClient.invalidateQueries({ queryKey: ["current-user"] });
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

    sendFriendRequest: sendFriendRequestMutation.mutateAsync,
    isSendingFriendRequest: sendFriendRequestMutation.isPending,

    acceptFriendRequest: acceptFriendRequestMutation.mutateAsync,
    isAcceptingFriendRequest: acceptFriendRequestMutation.isPending,

    rejectFriendRequest: rejectFriendRequestMutation.mutateAsync,
    isRejectingFriendRequest: rejectFriendRequestMutation.isPending,
  };

  return (
    <UsersContext.Provider value={context}>{children}</UsersContext.Provider>
  );
};

export const useCurrentUser = () => {
  const context = useContext(UsersContext);
  if (context === undefined) {
    throw new Error("useUsers must be used within a UsersProvider");
  }
  return context;
};

// Custom hooks for components to use
export const useUsers = (
  data: Array<
    { username: string; id?: string } | { username?: string; id: string }
  >
) => {
  const { isSignedIn } = useSession();
  const identifier = data
    .map((d) => d.username || d.id)
    .sort()
    .join(",");

  const queryKey = ["users", identifier];

  const query = useQuery({
    queryKey,
    queryFn: () => getUserBasicDataByUserNameOrId(data),
    enabled: isSignedIn && identifier.length > 0,
    staleTime: 1000 * 60 * 5,
  });

  // Handle errors manually
  if (query.error) {
    toast.error(`Failed to get users ${queryKey.join(",")}`);
  }

  return query;
};

export const useUser = (
  data: { username: string; id?: string } | { username?: string; id: string }
) => {
  const identifier = data.username || data.id;
  const { isSignedIn } = useSession();

  const query = useQuery({
    queryKey: ["user", identifier],
    queryFn: async () => {
      const users = await getUserBasicDataByUserNameOrId([data]);
      return users[0];
    },
    enabled: isSignedIn && !!identifier,
    staleTime: 1000 * 60 * 5,
  });

  if (query.error) {
    toast.error(`Failed to get user ${identifier}`);
  }

  return query;
};

// export const useMultipleUsers = (usernames: string[]) => {
//   const { isSignedIn } = useSession();
//   const { handleAuthError } = useUsers();
//   const queryClient = useQueryClient();

//   const query = useQuery({
//     queryKey: ["users", usernames.sort().join(",")],
//     queryFn: async () => {
//       const result: Record<string, HydratedUser> = {};

//       // Try to get from cache first
//       for (const username of usernames) {
//         const cached = queryClient.getQueryData<HydratedUser>(["user", username]);
//         if (cached) {
//           result[username] = cached;
//         }
//       }

//       // Fetch missing users
//       const missingUsernames = usernames.filter(u => !result[u]);
//       if (missingUsernames.length > 0) {
//         const promises = missingUsernames.map(async (username) => {
//           const userData = await getUserBasicData(username);
//           // Cache individual user data
//           queryClient.setQueryData(["user", username], userData);
//           return [username, userData] as const;
//         });

//         const fetchedUsers = await Promise.all(promises);
//         fetchedUsers.forEach(([username, userData]) => {
//           result[username] = userData;
//         });
//       }

//       return result;
//     },
//     enabled: isSignedIn && usernames.length > 0,
//     staleTime: 1000 * 60 * 5,
//   });

//   // Handle errors manually
//   if (query.error) {
//     handleAuthError(query.error);
//   }

//   return query;
// };
