import React, { createContext, useContext, useEffect } from "react";
import { useApiWithAuth } from "@/api";
import { parseISO, format, addMinutes, differenceInDays } from "date-fns";
import { useSession } from "@clerk/clerk-react";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import axios from "axios";
import {
  useQuery,
  UseQueryResult,
  useQueryClient,
} from "@tanstack/react-query";
import { usePostHog } from "posthog-js/react";
import { logger } from "@/utils/logger";
import { ThemeColor } from "@/utils/theme";
import { Properties } from "posthog-js";

export interface Activity {
  id: string;
  title: string;
  measure: string;
  emoji?: string;
  user_id?: string;
}

export interface ImageInfo {
  s3_path?: string;
  url?: string;
  expires_at?: string;
  created_at?: string;
  is_public?: boolean;
}

export interface ActivityEntry {
  id: string;
  activity_id: string;
  quantity: number;
  date: string;
  image?: ImageInfo;
  reactions?: Record<string, string[]>;
  description?: string;
  timezone?: string;
}

export interface CompletedSession extends Omit<ActivityEntry, "id" | "image"> {}

export interface MoodReport {
  id: string;
  user_id: string;
  date: string;
  score: string;
}

export interface Metric {
  id: string;
  title: string;
  emoji: string;
}

export interface MetricEntry {
  id: string;
  metric_id: string;
  rating: number;
  date: string;
  created_at: string;
}

export interface User {
  id: string;
  name?: string;
  plan_type: "free" | "plus";
  daily_checkin_settings?: {
    days: (
      | "MON"
      | "TUE"
      | "WED"
      | "THU"
      | "FRI"
      | "SAT"
      | "SUN"
      | "EVERYDAY"
    )[];
    time: "MORNING" | "AFTERNOON" | "EVENING";
  };
  picture?: string;
  username?: string;
  email: string;
  plan_ids: string[];
  friend_ids: string[];
  referred_user_ids: string[];
  pending_friend_requests: string[];
  timezone?: string;
  theme_base_color?: ThemeColor;
  is_dark_mode?: boolean;
}

interface FriendRequest {
  id: string;
  sender_id: string;
  recipient_id: string;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
  updated_at?: string;
}

export interface PlanGroupMember {
  user_id: string;
  username: string;
  name: string;
  picture: string;
}

export interface PlanGroup {
  id: string;
  plan_ids: string[];
  members?: PlanGroupMember[];
}

export interface PlanMilestoneCriteria {
  activity_id: string;
  quantity: number;
}

export interface PlanMilestoneCriteriaGroup {
  junction: "AND" | "OR";
  criteria: (PlanMilestoneCriteria | PlanMilestoneCriteriaGroup)[];
}

export interface PlanMilestone {
  date: Date;
  description: string;
  criteria?: (PlanMilestoneCriteria | PlanMilestoneCriteriaGroup)[];
  progress?: number;
}

export interface Plan {
  id?: string;
  user_id?: string;
  emoji?: string;
  goal: string;
  finishing_date?: Date;
  activity_ids?: string[];
  plan_group_id?: string;
  milestones?: PlanMilestone[];
  sessions: {
    date: Date;
    descriptive_guide: string;
    quantity: number;
    activity_id?: string;
    activity_name?: string;
  }[];
  notes?: string;
  duration_type?: "habit" | "lifestyle" | "custom";
  outline_type?: "specific" | "times_per_week";
  times_per_week?: number;
}

export interface ApiPlan {
  id: string;
  user_id: string;
  plan_group_id?: string;
  goal: string;
  emoji?: string;
  finishing_date?: string;
  activity_ids?: string[];
  sessions: {
    date: string;
    descriptive_guide: string;
    quantity: number;
    activity_id: string;
  }[];
  created_at: string;
  deleted_at?: string;
  duration_type?: "habit" | "lifestyle" | "custom";
  outline_type?: "specific" | "times_per_week";
  times_per_week?: number;
  notes?: string;
  milestones?: PlanMilestone[];
}

export interface Notification {
  id: string;
  user_id: string;
  message: string;
  created_at: string;
  processed_at: string | null;
  opened_at: string | null;
  concluded_at: string | null;
  status: "pending" | "processed" | "opened" | "concluded";
  type: "friend_request" | "plan_invitation" | "engagement" | "info";
  related_id: string | null;
  related_data: Record<string, string> | null;
}

export type Emotion = {
  name: string;
  score: number;
  color: string;
};
export interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  text: string;
  created_at: string;
  emotions: Emotion[];
}

export interface UserDataEntry {
  user: User | null;
  user_friends?: { picture: string; name: string; username: string }[];
  plans: ApiPlan[];
  planGroups: PlanGroup[];
  activities: Activity[];
  activityEntries: ActivityEntry[];
  moodReports: MoodReport[];
  sentFriendRequests: FriendRequest[];
  receivedFriendRequests: FriendRequest[];
  notifications: Notification[];
  expiresAt: string;
}

export interface TaggedActivityEntry extends ActivityEntry {
  is_week_finisher: boolean;
  plan_finished_name?: string;
}

export interface TimelineData {
  recommendedUsers?: User[];
  recommendedActivities?: Activity[];
  recommendedActivityEntries?: TaggedActivityEntry[];
  expiresAt: string;
}

export interface UserData {
  [username: string]: UserDataEntry;
}

export interface UserPlanContextType {
  useCurrentUserDataQuery: () => UseQueryResult<UserDataEntry>;
  useUserDataQuery: (username: string) => UseQueryResult<UserDataEntry>;
  useMultipleUsersDataQuery: (
    usernames: string[]
  ) => UseQueryResult<Record<string, UserDataEntry>>;
  useMetricsAndEntriesQuery: () => UseQueryResult<{
    metrics: Metric[];
    entries: MetricEntry[];
  }>;
  useHasMetricsToLogToday: () => boolean;
  useIsMetricLoggedToday: (metricId: string) => boolean;
  hasLoadedUserData: boolean;
  hasLoadedTimelineData: boolean;
  timelineData: UseQueryResult<TimelineData | null>;
  messagesData: UseQueryResult<{ messages: Message[] }>;
  notificationsData: UseQueryResult<{ notifications: Notification[] }>;
  fetchUserData: (options?: {
    username?: string;
    forceUpdate?: boolean;
  }) => Promise<UserDataEntry>;
  refetchUserData: () => Promise<UserDataEntry>;
  refetchAllData: () => Promise<UserDataEntry>;
  updateTimezone: () => Promise<void>;
  updateTheme: (color: ThemeColor) => Promise<void>;
  updateDarkMode: (isDark: boolean) => Promise<void>;
  currentTheme: ThemeColor;
  isDarkMode: boolean;
}

const UserPlanContext = createContext<UserPlanContextType | undefined>(
  undefined
);

const smallRetryMechanism = async <T,>(
  callback: () => Promise<T>,
  options?: {
    retryDelays?: number[];
    shouldRetry?: (error: unknown) => boolean;
  }
): Promise<T> => {
  const retryDelays = options?.retryDelays || [1000, 3000, 6000]; // Default delays in milliseconds
  let attempt = 0;

  while (attempt < retryDelays.length) {
    try {
      return await callback();
    } catch (err) {
      console.error(`Error in attempt ${attempt + 1}:`, err);

      const shouldRetry = options?.shouldRetry?.(err) ?? true;
      if (attempt === retryDelays.length - 1 || !shouldRetry) {
        throw err;
      }

      await new Promise((resolve) => setTimeout(resolve, retryDelays[attempt]));
      attempt++;
    }
  }

  throw new Error("Failed after all retries");
};

export function convertApiPlanToPlan(
  plan: ApiPlan,
  planActivities: Activity[]
): Plan {
  return {
    ...plan,
    finishing_date: plan.finishing_date
      ? parseISO(plan.finishing_date)
      : undefined,
    sessions: plan.sessions.map((session) => ({
      ...session,
      date: parseISO(session.date),
      activity_name: planActivities.find((a) => a.id === session.activity_id)
        ?.title,
    })),
  } as Plan;
}

export function convertPlanToApiPlan(plan: Plan): ApiPlan {
  return {
    ...plan,
    finishing_date: plan.finishing_date
      ? format(plan.finishing_date, "yyyy-MM-dd")
      : undefined,
    sessions: plan.sessions.map((session) => ({
      ...session,
      date: format(session.date, "yyyy-MM-dd"),
    })),
  } as ApiPlan;
}

export const UserPlanProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isSignedIn, isLoaded } = useSession();
  const router = useRouter();
  const { signOut } = useClerk();
  const api = useApiWithAuth();
  const posthog = usePostHog();
  const queryClient = useQueryClient();

  const handleAuthError = (err: unknown) => {
    console.error("[UserPlanProvider] Auth error:", err);
    if (axios.isAxiosError(err) && err.response?.status === 401) {
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
      posthog.reset();
      throw err;
    }
    throw err;
  };

  const fetchUserData = async ({
    username,
  }: { username?: string } = {}): Promise<UserDataEntry> => {
    if (!isSignedIn) {
      throw new Error("User not signed in");
    }

    try {
      const startTime = performance.now();
      const result = await smallRetryMechanism(
        async () => {
          const response = await api.get("/load-users-data", {
            params: username ? { usernames: username } : undefined,
          });

          const userData = username
            ? response.data[username]
            : response.data.current;

          if (!userData) {
            console.error(
              "[UserPlanProvider] No user data found in response:",
              response.data
            );
            throw new Error("No user data found in response");
          }

          const transformedData: UserDataEntry = {
            user: userData.user || null,
            plans: userData.plans || [],
            planGroups: userData.plan_groups || [],
            activities: userData.activities || [],
            activityEntries: userData.activity_entries || [],
            moodReports: userData.mood_reports || [],
            sentFriendRequests: userData.sent_friend_requests || [],
            receivedFriendRequests: userData.received_friend_requests || [],
            notifications: [],
            expiresAt: addMinutes(new Date(), 10).toISOString(),
          };

          const endTime = performance.now();
          const latencySeconds = (endTime - startTime) / 1000;

          if (!username) {
            // Only track for current user

            const latencyProperties: Properties = {
              latency_seconds: Math.round(latencySeconds * 1000) / 1000,
            };

            // Use direct capture method
            if (posthog) {
              posthog.capture("load-user-data", {
                $set: {
                  email: userData.user?.email,
                  name: userData.user?.name,
                  username: userData.user?.username,
                  plans_count: transformedData.plans.length,
                  plan_groups_count: transformedData.planGroups.length,
                  referral_count: userData.user?.referred_user_ids?.length || 0,
                  activities_count: transformedData.activities.length,
                  activity_entries_count: transformedData.activityEntries.length,
                  friend_count: userData.user?.friend_ids?.length || 0,
                  plan_type: userData.user?.plan_type,
                }
              });
              posthog.capture("load-user-data-latency", latencyProperties);
            }
          }

          return transformedData;
        },
        {
          shouldRetry: (err) =>
            axios.isAxiosError(err) &&
            (err.response?.status === 404 || err.response?.status === 401),
        }
      );

      return result;
    } catch (err) {
      console.error("[UserPlanProvider] Error fetching user data:", err);
      handleAuthError(err);
      router.push("/");
      toast.error("Failed to fetch user data. Please try again.");
      throw err;
    }
  };

  const fetchTimelineDataFn = async () => {
    if (!isSignedIn) return null;

    try {
      const startTime = performance.now();
      const response = await api.get("/timeline");
      const endTime = performance.now();
      const latencySeconds = (endTime - startTime) / 1000;

      const timelineLatencyProperties: Properties = {
        latency_seconds: Math.round(latencySeconds * 1000) / 1000,
      };

      // Use direct capture method
      if (posthog) {
        posthog.capture("timeline-latency", timelineLatencyProperties);
      }

      return {
        recommendedUsers: response.data.recommended_users,
        recommendedActivities: response.data.recommended_activities,
        recommendedActivityEntries: response.data.recommended_activity_entries,
        expiresAt: addMinutes(new Date(), 10).toISOString(),
      } as TimelineData;
    } catch (err) {
      handleAuthError(err);
      toast.error("Failed to fetch timeline data. Please try again.");
      throw err;
    }
  };

  const fetchMetricsData = async () => {
    if (!isSignedIn) {
      throw new Error("User not signed in");
    }

    try {
      const startTime = performance.now();
      const result = await smallRetryMechanism(
        async () => {
          const [metricsResponse, entriesResponse] = await Promise.all([
            api.get("/metrics"),
            api.get("/metric-entries"),
          ]);

          const endTime = performance.now();
          const latencySeconds = (endTime - startTime) / 1000;

          const latencyProperties: Properties = {
            latency_seconds: Math.round(latencySeconds * 1000) / 1000,
          };

          // Use direct capture method
          if (posthog) {
            posthog.capture("load-metrics-data-latency", latencyProperties);
          }

          return {
            metrics: metricsResponse.data as Metric[],
            entries: entriesResponse.data as MetricEntry[],
          };
        },
        {
          shouldRetry: (err) =>
            axios.isAxiosError(err) &&
            (err.response?.status === 404 || err.response?.status === 401),
        }
      );

      return result;
    } catch (err) {
      console.error("[UserPlanProvider] Error fetching metrics data:", err);
      handleAuthError(err);
      toast.error("Failed to fetch metrics data. Please try again.");
      throw err;
    }
  };

  const useCurrentUserDataQuery = () => {
    const query = useQuery({
      queryKey: ["userData", "current"],
      queryFn: () => fetchUserData(),
      enabled: isLoaded && isSignedIn,
      staleTime: 1000 * 60 * 5, // 5 minutes
    });

    return query;
  };

  const useUserDataQuery = (username: string) => {
    const { isSignedIn, isLoaded } = useSession();
    const currentUserQuery = useCurrentUserDataQuery();

    return useQuery({
      queryKey: ["userData", username],
      queryFn: () => fetchUserData({ username }),
      enabled: isLoaded && isSignedIn && !!username,
      staleTime: 1000 * 60 * 5, // 5 minutes,
      // If the requested username matches current user's username, use that data instead
      initialData: () => {
        if (
          currentUserQuery.data?.user?.username?.toLowerCase() ===
          username.toLowerCase()
        ) {
          return currentUserQuery.data;
        }
        return undefined;
      },
    });
  };

  const timelineData = useQuery({
    queryKey: ["timelineData"],
    queryFn: fetchTimelineDataFn,
    enabled: isSignedIn && isLoaded,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const useMultipleUsersDataQuery = (usernames: string[]) =>
    useQuery({
      queryKey: ["multipleUsersData", usernames.sort().join(",")],
      queryFn: async () => {
        try {
          const response = await api.get("/load-users-data", {
            params: { usernames: usernames.join(",") },
          });
          const transformedData: Record<string, UserDataEntry> = {};
          for (const [key, value] of Object.entries(response.data)) {
            const typedValue = value as {
              user: any;
              activities: any[];
              activity_entries: any[];
              mood_reports: any[];
              plans: any[];
              plan_groups: any[];
              sent_friend_requests?: any[];
              received_friend_requests?: any[];
              messages: any[];
            };

            transformedData[key] = {
              user: typedValue.user,
              activities: typedValue.activities,
              activityEntries: typedValue.activity_entries,
              moodReports: typedValue.mood_reports,
              plans: typedValue.plans,
              planGroups: typedValue.plan_groups,
              sentFriendRequests: typedValue.sent_friend_requests || [],
              receivedFriendRequests: typedValue.received_friend_requests || [],
              notifications: [],
              expiresAt: addMinutes(new Date(), 10).toISOString(),
            };
          }
          return transformedData;
        } catch (err) {
          handleAuthError(err);
          throw err;
        }
      },
      enabled: isSignedIn && usernames.length > 0,
      staleTime: 1000 * 60 * 5, // 5 minutes
    });

  const messagesData = useQuery({
    queryKey: ["messagesData"],
    queryFn: async () => {
      try {
        const response = await api.get("/load-messages");
        return response.data;
      } catch (err) {
        handleAuthError(err);
        throw err;
      }
    },
    enabled: !!isSignedIn && isLoaded,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: false,
  });

  const notificationsData = useQuery({
    queryKey: ["notificationsData"],
    queryFn: async () => {
      try {
        const response = await api.get("/load-notifications");
        return response.data;
      } catch (err) {
        handleAuthError(err);
        throw err;
      }
    },
    enabled: !!isSignedIn && isLoaded,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: false,
  });

  const currentUserDataQuery = useCurrentUserDataQuery();

  const refetchUserData = async () => {
    return toast.promise(
      currentUserDataQuery.refetch().then((result) => {
        if (result.error) throw result.error;
        if (!result.data) throw new Error("User data is undefined");
        return result.data;
      }),
      {
        loading: "Updating...",
        success: "Updated successfully",
        error: "Failed to update",
      }
    );
  };

  const refetchAllData = async () => {
    return toast.promise(
      Promise.all([
        currentUserDataQuery.refetch(),
        timelineData.refetch(),
        notificationsData.refetch(),
        messagesData.refetch(),
      ]).then(([userData]) => {
        if (userData.error) throw userData.error;
        if (!userData.data) throw new Error("User data is undefined");
        return userData.data;
      }),
      {
        loading: "Refreshing all data...",
        success: "All data refreshed successfully",
        error: "Failed to refresh data",
      }
    );
  };

  const useMetricsAndEntriesQuery = () =>
    useQuery({
      queryKey: ["metricsAndEntries"],
      queryFn: fetchMetricsData,
      enabled: isLoaded && isSignedIn,
      staleTime: 1000 * 60 * 5, // 5 minutes
    });

  const useIsMetricLoggedToday = (metricId: string) => {
    const { data: metricsAndEntriesData } = useMetricsAndEntriesQuery();
    const entries = metricsAndEntriesData?.entries || [];
    const today = new Date().toISOString().split("T")[0];

    return entries.some(
      (entry) =>
        entry.metric_id === metricId && entry.date.split("T")[0] === today
    );
  };

  const useHasMetricsToLogToday = () => {
    const { data: metricsAndEntriesData } = useMetricsAndEntriesQuery();
    const metrics = metricsAndEntriesData?.metrics || [];
    const entries = metricsAndEntriesData?.entries || [];
    const today = new Date().toISOString().split("T")[0];

    // Check if there are any metrics that haven't been logged today
    return metrics.some(
      (metric) =>
        !entries.some(
          (entry) =>
            entry.metric_id === metric.id && entry.date.split("T")[0] === today
        )
    );
  };

  const updateTimezone = async () => {
    if (!isSignedIn) return;

    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const response = await api.post("/update-timezone", { timezone });
      currentUserDataQuery.refetch();
      console.log("timezone updated to", timezone);
      return response.data;
    } catch (err) {
      handleAuthError(err);
      if (axios.isAxiosError(err) && err.response?.status === 400) {
        logger.error(`Invalid timezone: ${err.response.data.detail}`);
        toast.error("Failed to set timezone: Invalid timezone format");
      } else {
        toast.error("Failed to update timezone");
      }
      throw err;
    }
  };

  // Add updateTimezone to the effect that runs when the user signs in
  useEffect(() => {
    const currenttimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (
      isSignedIn &&
      currentUserDataQuery.data?.user &&
      currentUserDataQuery.data.user.timezone !== currenttimezone
    ) {
      updateTimezone().catch((err) => {
        logger.error("Failed to update timezone on initial load:", err);
      });
    }
  }, [isSignedIn, currentUserDataQuery.data?.user]);

  useEffect(() => {
    if (!isSignedIn) {
      queryClient.clear();
    }
  }, [isSignedIn, queryClient]);

  const updateTheme = async (color: ThemeColor) => {
    if (!isSignedIn) return;

    try {
      await api.post("/update-theme", { theme_base_color: color });
      await currentUserDataQuery.refetch();
    } catch (err) {
      handleAuthError(err);
      throw err;
    }
  };

  const updateDarkMode = async (isDark: boolean) => {
    try {
      const { data } = await api.patch("/users/me", {
        is_dark_mode: isDark,
      });
      await refetchUserData();
      return data;
    } catch (err) {
      handleAuthError(err);
      throw err;
    }
  };

  const currentTheme =
    currentUserDataQuery.data?.user?.theme_base_color || "blue";
  const isDarkMode = currentUserDataQuery.data?.user?.is_dark_mode || false;

  const context = {
    useCurrentUserDataQuery,
    useUserDataQuery,
    useMultipleUsersDataQuery,
    useMetricsAndEntriesQuery,
    useIsMetricLoggedToday,
    useHasMetricsToLogToday,
    hasLoadedUserData:
      currentUserDataQuery.isSuccess && !!currentUserDataQuery.data,
    hasLoadedTimelineData: timelineData.isSuccess && !!timelineData.data,
    timelineData,
    messagesData,
    notificationsData,
    fetchUserData,
    refetchUserData,
    refetchAllData,
    updateTimezone,
    updateTheme,
    updateDarkMode,
    currentTheme,
    isDarkMode,
  };

  return (
    <UserPlanContext.Provider value={context}>
      {children}
    </UserPlanContext.Provider>
  );
};

export const useUserPlan = () => {
  const context = useContext(UserPlanContext);
  if (context === undefined) {
    throw new Error("useUserPlan must be used within a UserPlanProvider");
  }
  return context;
};
