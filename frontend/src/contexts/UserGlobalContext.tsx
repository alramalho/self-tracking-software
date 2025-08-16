import React, {
  createContext,
  useContext,
  useEffect,
  useCallback,
} from "react";
import { useSession } from "@clerk/clerk-react";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import {
  useQuery,
  UseQueryResult,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ThemeColor,
  User,
  Metric,
  MetricEntry,
} from "@/zero/schema";
import { Plan, PlanMilestone } from "@prisma/types";
import { useZ } from "@/hooks/useZ";
import { HydratedCurrentUser, HydratedUser, TimelineData, getCurrentUser, getOtherUser, getTimeline, getMessages, getMetricsAndEntries, MessagesWithRelations } from "@/zero/queries";

export type CompletePlan = Omit<HydratedCurrentUser["plans"][number], "milestones"> & {
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


export type Recommendation = {
  recommendationObjectId: string;
  recommendationObjectType: "user" | "plan";
  score: number;
};

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
  useHasMetricsToLogToday: () => boolean;
  useIsMetricLoggedToday: (metricId: string) => boolean;
  hasLoadedUserData: boolean;
  messagesData: UseQueryResult<{ messages: MessagesWithRelations[] }>;
  refetchUserData: (notify?: boolean) => Promise<HydratedCurrentUser>;
  refetchAllData: () => Promise<HydratedCurrentUser>;
  updateLocalUserData: (
    updater: (data: HydratedCurrentUser) => HydratedCurrentUser
  ) => void;
  currentTheme: ThemeColorType;
  syncCurrentUserWithProfile: () => void;
  isWaitingForData: boolean;
}

const UserGlobalContext = createContext<UserGlobalContextType | undefined>(
  undefined
);

// Function to check if we have any cached query data by TanStack Query
export const hasCachedUserData = () => {
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
  const z = useZ();

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
      queryFn: async () => {
        return await getCurrentUser(z);
      },
      enabled: isLoaded && isSignedIn,
    });

    return query;
  };

  const useRecommendedUsersQuery = () => {
    const query = useQuery({
      queryKey: ["recommendedUsers"],
      queryFn: async () => {
        // Return empty data for now - can be implemented with server actions later
        const result = {
          recommendations: [],
          users: [],
          plans: [],
        };
        return result;
      },
      enabled: isSignedIn && isLoaded,
      staleTime: 1000 * 60 * 5,
    });

    return query;
  };

  const useUserDataQuery = (username: string) => {
    const { isSignedIn, isLoaded } = useSession();

    const query = useQuery({
      queryKey: ["userData", username],
      queryFn: () => {
        return getOtherUser(z, { username }).then(result => {
          return result;
        }).catch(error => {
          throw error;
        });
      },
      enabled: isLoaded && isSignedIn && !!username,
      staleTime: 1000 * 60 * 5,
      // initialData: () => {
      //   if (
      //     currentUserQuery.data?.username?.toLowerCase() ===
      //     username.toLowerCase()
      //   ) {
      //     return currentUserQuery.data as HydratedUser;
      //   }
      //   return undefined;
      // },
    });

    return query;
  };

  const useTimelineDataQuery = () => {
    const query = useQuery({
      queryKey: ["timelineData"],
      queryFn: async () => {
        if (!currentUserDataQuery.data?.id) {
          throw new Error("User ID not available");
        }
        const result = await getTimeline(z, { userId: currentUserDataQuery.data.id });
        return result;
      },
      enabled: isLoaded && isSignedIn && !!currentUserDataQuery.data?.id,
    });

    return query;
  };

  const useMultipleUsersDataQuery = (usernames: string[]) => {
    const query = useQuery({
      queryKey: ["multipleUsersData", usernames.sort().join(",")],
      queryFn: async () => {
        try {
          const transformedData: Record<string, any> = {};
          // Fetch each user's data individually using server actions
          for (const username of usernames) {
            const userData = await getOtherUser(z, { username });
            transformedData[username] = userData;
          }
          return transformedData;
        } catch (err) {
          console.error("[useMultipleUsersDataQuery] Query error:", err);
          handleAuthError(err);
          throw err;
        }
      },
      enabled: isSignedIn && usernames.length > 0,
      staleTime: 1000 * 60 * 5,
    });

    return query;
  };

  const currentUserDataQuery = useCurrentUserDataQuery();

  const messagesData = useQuery({
    queryKey: ["messagesData"],
    queryFn: async () => {
      try {
        if (!currentUserDataQuery.data?.id) {
          throw new Error("User ID not available");
        }
        const result = await getMessages(z, { userId: currentUserDataQuery.data.id });
        return result;
      } catch (err) {
        console.error("[messagesData] Query error:", err);
        handleAuthError(err);
        throw err;
      }
    },
    enabled: !!isSignedIn && isLoaded && !!currentUserDataQuery.data?.id,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });


  const timelineDataQuery = useTimelineDataQuery();

  const refetchUserData = useCallback(
    async (notify = true) => {
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
      queryFn: () => {
        if (!currentUserDataQuery.data?.id) {
          throw new Error("User ID not available");
        }
        return getMetricsAndEntries(z, { userId: currentUserDataQuery.data.id });
      },
      enabled: isLoaded && isSignedIn && !!currentUserDataQuery.data?.id,
      staleTime: 1000 * 60 * 5,
    });

  const useIsMetricLoggedToday = (metricId: string) => {
    const { data: metricsAndEntriesData } = useMetricsAndEntriesQuery();
    const entries = metricsAndEntriesData?.entries || [];
    const today = new Date().toISOString().split("T")[0];

    return entries.some(
      (entry) =>
        entry.metricId === metricId && new Date(entry.date).toISOString().split("T")[0] === today
    );
  };

  const useHasMetricsToLogToday = () => {
    const { data: metricsAndEntriesData } = useMetricsAndEntriesQuery();
    const metrics = metricsAndEntriesData?.metrics || [];
    const entries = metricsAndEntriesData?.entries || [];
    const today = new Date().toISOString().split("T")[0];

    return metrics.some(
      (metric) =>
        !entries.some(
          (entry) =>
            entry.metricId === metric.id && new Date(entry.date).toISOString().split("T")[0] === today
        )
    );
  };


  useEffect(() => {
    const currentTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (
      isSignedIn &&
      currentUserDataQuery.data &&
      currentUserDataQuery.data.timezone !== currentTimezone
    ) {
      // TODO: Implement timezone update using Zero mutators
    }
  }, [isSignedIn, currentUserDataQuery.data]);

  useEffect(() => {
    if (!isSignedIn) {
      queryClient.clear();
    }
  }, [isSignedIn, queryClient]);

  const updateTheme = useCallback(
    async (color: ThemeColorType) => {
      if (!isSignedIn || !currentUserDataQuery.data) return;

      try {
        // Convert to the correct enum value
        const themeColor = color.toUpperCase() as ThemeColor;
        // TODO: Implement theme update using Zero mutators
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

  const context = {
    useCurrentUserDataQuery,
    useUserDataQuery,
    useRecommendedUsersQuery,
    useMultipleUsersDataQuery,
    useMetricsAndEntriesQuery,
    useTimelineDataQuery,
    useIsMetricLoggedToday,
    useHasMetricsToLogToday,
    hasLoadedUserData:
      currentUserDataQuery.isSuccess && !!currentUserDataQuery.data,
    messagesData,
    refetchUserData,
    refetchAllData,
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
      currentUserDataQuery.isPending ||
      currentUserDataQuery.isFetching ||
      timelineDataQuery.isPending ||
      timelineDataQuery.isFetching ||
      messagesData.isPending ||
      messagesData.isFetching,
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
