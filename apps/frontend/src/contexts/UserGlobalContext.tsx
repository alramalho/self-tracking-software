import { useApiWithAuth } from "@/api";
import {
  getCurrentUserData,
  getMessages,
  getMetricsAndEntries,
  getTimelineData,
  getUserData,
  HydratedCurrentUser,
  HydratedUser,
  TimelineData,
  updateUser,
} from "@/app/actions";
import { useSession } from "@clerk/clerk-react";
import { useClerk } from "@clerk/nextjs";
import {
  useQuery,
  useQueryClient,
  UseQueryResult,
} from "@tanstack/react-query";
import {
  Message,
  MessageEmotion,
  Metric,
  MetricEntry,
  Notification,
  Recommendation,
  ThemeColor,
  User
} from "@tsw/prisma";
import { Plan, PlanMilestone } from "@tsw/prisma/types";
import { useRouter } from "next/navigation";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
} from "react";
import { toast } from "react-hot-toast";

type MessagesWithRelations = Message & {
  emotions: MessageEmotion[];
};

export type CompletePlan = Omit<
  HydratedCurrentUser["plans"][number],
  "milestones"
> & {
  milestones: PlanMilestone[];
};

// Theme color mapping for legacy compatibility
export type ThemeColorType =
  | "blue"
  | "violet"
  | "emerald"
  | "rose"
  | "amber"
  | "slate"
  | "random";


export interface UserGlobalContextType {
  useCurrentUserDataQuery: () => UseQueryResult<HydratedCurrentUser>;
  useTimelineDataQuery: () => UseQueryResult<TimelineData>;
  useUserDataQuery: (username: string) => UseQueryResult<HydratedUser>;
  useRecommendedUsersQuery: () => UseQueryResult<{
    recommendations: Recommendation[];
    users: User[];
    plans: Plan[];
  }>;
  useMultipleUsersDataQuery: (
    usernames: string[]
  ) => UseQueryResult<Record<string, HydratedUser>>;
  useMetricsAndEntriesQuery: () => UseQueryResult<{
    metrics: Metric[];
    entries: MetricEntry[];
  }>;
  hasLoadedUserData: boolean;
  messagesData: UseQueryResult<{ messages: MessagesWithRelations[] }>;
  notificationsData: UseQueryResult<{ notifications: Notification[] }>;
  refetchUserData: (notify?: boolean) => Promise<HydratedCurrentUser>;
  refetchAllData: () => Promise<HydratedCurrentUser>;
  updateLocalUserData: (
    updater: (data: HydratedCurrentUser) => HydratedCurrentUser
  ) => void;
  currentTheme: ThemeColorType;
  updateTheme: (color: ThemeColorType) => Promise<void>;
  syncCurrentUserWithProfile: () => void;
  isWaitingForData: boolean;
}

const UserGlobalContext = createContext<UserGlobalContextType | undefined>(
  undefined
);

// Function to check if we have any cached query data by TanStack Query
export const hasCacheData = () => {
  if (typeof window === "undefined") return false;
  try {
    const cachedData = localStorage.getItem("TRACKING_SO_QUERY_CACHE");
    if (!cachedData) return false;

    const parsedCache = JSON.parse(cachedData);
    const queries = parsedCache?.clientState?.queries;
    const mutations = parsedCache?.clientState?.mutations;
    return (
      (Array.isArray(queries) && queries.length > 0) ||
      (Array.isArray(mutations) && mutations.length > 0)
    );
  } catch (error) {
    console.warn("Error checking for cached user data:", error);
    return false;
  }
};

export const UserPlanProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isSignedIn, isLoaded } = useSession();
  const router = useRouter();
  const { signOut } = useClerk();
  const queryClient = useQueryClient();
  const api = useApiWithAuth();

  const handleAuthError = useCallback(
    (err: unknown) => {
      console.error("[UserPlanProvider] Auth error:", err);
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

  const useCurrentUserDataQuery = () => {
    const query = useQuery({
      queryKey: ["userData", "current"],
      queryFn: () => {
        console.log("isSignedIn", isSignedIn);
        console.log("isLoaded", isLoaded);
        return getCurrentUserData();
      },
      enabled: isLoaded && isSignedIn,
    });

    return query;
  };

  const useRecommendedUsersQuery = () => {
    const query = useQuery({
      queryKey: ["recommendedUsers"],
      queryFn: async () => {
        const response = await api.get("/users/recommended-users");
        return response.data;
      },
      enabled: isSignedIn && isLoaded,
      staleTime: 1000 * 60 * 5,
    });
    return query;
  };

  const useUserDataQuery = (username: string) => {
    const { isSignedIn, isLoaded } = useSession();
    const currentUserQuery = useCurrentUserDataQuery();

    return useQuery({
      queryKey: ["userData", username],
      queryFn: () => getUserData(username),
      enabled: isLoaded && isSignedIn && !!username,
      staleTime: 1000 * 60 * 5,
      initialData: () => {
        if (
          currentUserQuery.data?.username?.toLowerCase() ===
          username.toLowerCase()
        ) {
          return currentUserQuery.data as HydratedUser;
        }
        return undefined;
      },
    });
  };

  const useTimelineDataQuery = () => {
    const query = useQuery({
      queryKey: ["timelineData"],
      queryFn: () => getTimelineData(),
      enabled: isLoaded && isSignedIn,
    });

    return query;
  };

  const useMultipleUsersDataQuery = (usernames: string[]) =>
    useQuery({
      queryKey: ["multipleUsersData", usernames.sort().join(",")],
      queryFn: async () => {
        try {
          const transformedData: Record<string, any> = {};
          // Fetch each user's data individually using server actions
          for (const username of usernames) {
            const userData = await getUserData(username);
            transformedData[username] = userData;
          }
          return transformedData;
        } catch (err) {
          handleAuthError(err);
          throw err;
        }
      },
      enabled: isSignedIn && usernames.length > 0,
      staleTime: 1000 * 60 * 5,
    });

  const messagesData = useQuery({
    queryKey: ["messagesData"],
    queryFn: async () => {
      try {
        const result = await getMessages();
        return result;
      } catch (err) {
        handleAuthError(err);
        throw err;
      }
    },
    enabled: !!isSignedIn && isLoaded,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  const notificationsData = useQuery({
    queryKey: ["notificationsData"],
    queryFn: async () => {
      try {
        // Notifications are already included in getCurrentUserData
        const userData = await getCurrentUserData();
        return { notifications: userData.notifications };
      } catch (err) {
        handleAuthError(err);
        throw err;
      }
    },
    enabled: !!isSignedIn && isLoaded,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  const currentUserDataQuery = useCurrentUserDataQuery();
  const timelineDataQuery = useTimelineDataQuery();

  const refetchUserData = useCallback(
    async (notify = false) => {
      await queryClient.refetchQueries({ queryKey: ["userData"] });

      const refetchPromise = currentUserDataQuery.refetch().then((result) => {
        if (result.error) throw result.error;
        if (!result.data) throw new Error("User data is undefined");
        return result.data;
      });

      if (notify) {
        return toast.promise(refetchPromise, {
          loading: "Updating...",
          success: "Updated successfully",
          error: "Failed to update",
        });
      }

      return refetchPromise;
    },
    [queryClient, currentUserDataQuery]
  );

  const refetchAllData = useCallback(async () => {
    try {
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["userData"] }),
        queryClient.refetchQueries({ queryKey: ["timelineData"] }),
        queryClient.refetchQueries({ queryKey: ["notificationsData"] }),
        queryClient.refetchQueries({ queryKey: ["messagesData"] }),
        queryClient.refetchQueries({ queryKey: ["recommendedUsers"] }),
        queryClient.refetchQueries({ queryKey: ["multipleUsersData"] }),
        queryClient.refetchQueries({ queryKey: ["metricsAndEntries"] }),
      ]);

      const userData = await currentUserDataQuery.refetch();

      if (userData.error) throw userData.error;
      if (!userData.data) throw new Error("User data is undefined");
      return userData.data;
    } catch (err) {
      toast.error("Failed to refresh data");
      throw err;
    }
  }, [queryClient, currentUserDataQuery]);

  const useMetricsAndEntriesQuery = () =>
    useQuery({
      queryKey: ["metricsAndEntries"],
      queryFn: () => getMetricsAndEntries(),
      enabled: isLoaded && isSignedIn,
      staleTime: 1000 * 60 * 5,
    });

  useEffect(() => {
    const currentTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (
      isSignedIn &&
      currentUserDataQuery.data &&
      currentUserDataQuery.data.timezone !== currentTimezone
    ) {
      updateUser({ timezone: currentTimezone }).catch((err) => {
        console.error("Failed to update timezone on initial load:", err);
      });
    }
  }, [isSignedIn, currentUserDataQuery.data]);

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      console.log("🧹 Clearing cache because not signed in");
      queryClient.clear();
      // Also clear localStorage to prevent persistence issues
      if (typeof window !== "undefined") {
        localStorage.removeItem("TRACKING_SO_QUERY_CACHE");
      }
    }
  }, [isSignedIn, isLoaded, queryClient]);

  const updateTheme = useCallback(
    async (color: ThemeColorType) => {
      if (!isSignedIn) return;

      try {
        // Convert to the correct enum value
        const themeColor = color.toUpperCase() as ThemeColor;
        await updateUser({ themeBaseColor: themeColor });
        await currentUserDataQuery.refetch();
      } catch (err) {
        handleAuthError(err);
        throw err;
      }
    },
    [isSignedIn, currentUserDataQuery, handleAuthError]
  );

  const syncUserData = useCallback(
    (userData: HydratedCurrentUser) => {
      if (userData.username) {
        queryClient.invalidateQueries({
          queryKey: ["userData", userData.username],
        });
      }
    },
    [queryClient]
  );

  useEffect(() => {
    if (currentUserDataQuery.data?.username && isSignedIn) {
      const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
        if (
          event.type === "updated" &&
          event.query.queryKey[0] === "userData" &&
          event.query.queryKey[1] === "current"
        ) {
          syncUserData(event.query.state.data as HydratedCurrentUser);
        }
      });

      return () => {
        unsubscribe();
      };
    }
  }, [
    currentUserDataQuery.data?.username,
    isSignedIn,
    queryClient,
    syncUserData,
  ]);

  const currentTheme: ThemeColorType =
    (currentUserDataQuery.data?.themeBaseColor?.toLowerCase() as ThemeColorType) ||
    "blue";

  useEffect(() => {
    console.log("hasCachedData", hasCacheData());
    console.log("currentUserDataQuery.isFetching", currentUserDataQuery.isFetching);
    console.log("currentUserDataQuery.isFetched", currentUserDataQuery.isFetching);
    console.log("timelineDataQuery.isFetching", timelineDataQuery.isFetching);
    console.log("timelineDataQuery.isFetched", timelineDataQuery.isFetched);
    console.log("notificationsData.isFetching", notificationsData.isFetching);
    console.log("notificationsData.isFetched", notificationsData.isFetched);
    console.log("messagesData.isFetching", messagesData.isFetching);
    console.log("messagesData.isFetched", messagesData.isFetched);
  }, [currentUserDataQuery.isFetching, timelineDataQuery.isFetching, notificationsData.isFetching, messagesData.isFetching]);

  const context = {
    useCurrentUserDataQuery,
    useUserDataQuery,
    useRecommendedUsersQuery,
    useMultipleUsersDataQuery,
    useMetricsAndEntriesQuery,
    useTimelineDataQuery,
    hasLoadedUserData:
      currentUserDataQuery.isSuccess && !!currentUserDataQuery.data,
    messagesData,
    notificationsData,
    refetchUserData,
    refetchAllData,
    updateTheme,
    updateLocalUserData: (
      updater: (data: HydratedCurrentUser) => HydratedCurrentUser
    ) => {
      queryClient.setQueryData(
        ["userData", "current"],
        (oldData: HydratedCurrentUser | undefined) => {
          if (!oldData) return oldData;
          return updater(oldData);
        }
      );
    },
    currentTheme,
    syncCurrentUserWithProfile: () => {
      if (currentUserDataQuery.data) {
        syncUserData(currentUserDataQuery.data);
      }
    },
    isWaitingForData:
      !hasCacheData() &&
      currentUserDataQuery.isFetched &&
        timelineDataQuery.isFetched &&
      notificationsData.isFetched &&
      messagesData.isFetched,
  };

  return (
    <UserGlobalContext.Provider value={context}>
      {children}
    </UserGlobalContext.Provider>
  );
};

export const useUserPlan = () => {
  const context = useContext(UserGlobalContext);
  if (context === undefined) {
    throw new Error("useUserPlan must be used within a UserPlanProvider");
  }
  return context;
};
