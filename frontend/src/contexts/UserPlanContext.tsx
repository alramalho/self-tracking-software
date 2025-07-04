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
  QueryClient,
} from "@tanstack/react-query";
import { usePostHog } from "posthog-js/react";
import { logger } from "@/utils/logger";
import { ThemeColor } from "@/utils/theme";
import { Properties } from "posthog-js";

export type VisibilityType = "public" | "private" | "friends";

export interface Activity {
  id: string;
  title: string;
  measure: string;
  emoji?: string;
  user_id?: string;
  privacy_settings?: VisibilityType;
  color_hex?: string;
}

export interface ImageInfo {
  s3_path?: string;
  url?: string;
  expires_at?: string;
  created_at?: string;
  is_public?: boolean;
}

export interface Comment {
  id: string;
  user_id: string;
  username: string;
  text: string;
  created_at: string;
  picture?: string;
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
  comments?: Comment[];
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
  description?: string;
  skipped?: boolean;
  description_skipped?: boolean;
}

export interface User {
  id: string;
  name?: string;
  age?: number;
  profile?: string;
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
  looking_for_ap?: boolean;
  username?: string;
  email: string;
  plan_ids: string[];
  friend_ids: string[];
  referred_user_ids: string[];
  pending_friend_requests: string[];
  timezone?: string;
  theme_base_color?: ThemeColor;
  default_activity_visibility: VisibilityType;
  created_at?: string;
  last_active_at?: string;
}

export interface FriendRequest {
  id: string;
  message?: string;
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

export interface ApiPlanSession {
  date: string;
  descriptive_guide: string;
  quantity: number;
  activity_id: string;
}

export interface PlanSession extends Omit<ApiPlanSession, "date"> {
  date: Date
  activity_name?: string
}

interface PlanCurrentWeek {
  state: "ON_TRACK" | "AT_RISK" | "FAILED" | "COMPLETED";
  state_last_calculated_at?: string;
}

export type PlanType = "times_per_week" | "specific";

export interface Plan {
  id?: string;
  user_id?: string;
  emoji?: string;
  goal: string;
  state: "ON_TRACK" | "AT_RISK" | "FAILED" | "COMPLETED";
  finishing_date?: Date;
  activity_ids?: string[];
  plan_group_id?: string;
  milestones?: PlanMilestone[];
  sessions: PlanSession[];
  coach_suggested_sessions: PlanSession[];
  notes?: string;
  duration_type?: "habit" | "lifestyle" | "custom";
  outline_type?: PlanType;
  times_per_week?: number;
  coach_suggested_times_per_week?: number;
  created_at: string;
  suggested_by_coach_at?: string;
  coach_notes?: string;
  current_week?: PlanCurrentWeek
}

export interface ApiPlan {
  id: string;
  user_id: string;
  plan_group_id?: string;
  goal: string;
  
  emoji?: string;
  finishing_date?: string;
  activity_ids?: string[];
  sessions: ApiPlanSession[];
  coach_suggested_sessions: ApiPlanSession[];
  created_at: string;
  deleted_at?: string;
  duration_type?: "habit" | "lifestyle" | "custom";
  outline_type?: "specific" | "times_per_week";
  times_per_week?: number;
  coach_suggested_times_per_week?: number;
  notes?: string;
  milestones?: PlanMilestone[];
  suggested_by_coach_at?: string;
  coach_notes?: string;
  current_week?: PlanCurrentWeek
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
  type: "friend_request" | "plan_invitation" | "engagement" | "info" | "coach";
  related_id: string | null;
  related_data: Record<string, string> | null;
}

export type Recommendation = {
  recommendation_object_id: string;
  recommendation_object_type: "user" | "plan";
  score: number;
};

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
}

export interface TaggedActivityEntry extends ActivityEntry {
  is_week_finisher: boolean;
  plan_finished_name?: string;
}

export interface TimelineData {
  recommendedUsers?: User[];
  recommendedActivities?: Activity[];
  recommendedActivityEntries?: TaggedActivityEntry[];
}

export interface UserData {
  [username: string]: UserDataEntry;
}

export interface UserPlanContextType {
  useCurrentUserDataQuery: () => UseQueryResult<UserDataEntry>;
  useTimelineDataQuery: () => UseQueryResult<TimelineData | null>;
  useUserDataQuery: (username: string) => UseQueryResult<UserDataEntry>;
  useRecommendedUsersQuery: () => UseQueryResult<{
    recommendations: Recommendation[];
    users: User[];
    plans: ApiPlan[];
  }>;
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
  messagesData: UseQueryResult<{ messages: Message[] }>;
  notificationsData: UseQueryResult<{ notifications: Notification[] }>;
  fetchUserData: (options?: {
    username?: string;
    forceUpdate?: boolean;
  }) => Promise<UserDataEntry>;
  refetchUserData: (notify?: boolean) => Promise<UserDataEntry>;
  refetchAllData: () => Promise<UserDataEntry>;
  updateTimezone: () => Promise<void>;
  updateTheme: (color: ThemeColor) => Promise<void>;
  updateLocalUserData: (
    updater: (data: UserDataEntry) => UserDataEntry
  ) => void;
  currentTheme: ThemeColor;
  syncCurrentUserWithProfile: () => void;
  isWaitingForData: boolean;
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
    sessions: plan?.sessions?.map((session) => ({
      ...session,
      date: parseISO(session.date),
      activity_name: planActivities.find((a) => a.id === session.activity_id)
        ?.title,
    })),
    coach_suggested_sessions: plan?.coach_suggested_sessions?.map((session) => ({
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
    coach_suggested_sessions: plan.coach_suggested_sessions?.map((session) => ({
      ...session,
      date: format(session.date, "yyyy-MM-dd"),
    })),
  } as ApiPlan;
}

// Function to check if we have any cached query data by TanStack Query
export const hasCachedUserData = () => {
  if (typeof window === "undefined") return false;
  try {
    // Check if the cache key used by PersistQueryClientProvider exists
    const cachedData = localStorage.getItem("TRACKING_SO_QUERY_CACHE");
    if (!cachedData) return false;

    // Parse the cache and check if there are any queries in clientState
    const parsedCache = JSON.parse(cachedData);
    const queries = parsedCache?.clientState?.queries;
    const mutations = parsedCache?.clientState?.mutations;
    return (
      (Array.isArray(queries) && queries.length > 0) ||
      (Array.isArray(mutations) && mutations.length > 0)
    );
  } catch (error) {
    // If parsing fails or any other error, assume no valid cache
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
  const api = useApiWithAuth();
  const posthog = usePostHog();
  const queryClient = useQueryClient(); // This hook provides the QueryClient instance configured in layoutClient.tsx

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
                  created_at: userData.user?.created_at
                    ? new Date(userData.user.created_at).toISOString()
                    : undefined,
                  email: userData.user?.email,
                  name: userData.user?.name,
                  username: userData.user?.username,
                  plans_count: transformedData.plans.length,
                  plan_groups_count: transformedData.planGroups.length,
                  referral_count: userData.user?.referred_user_ids?.length || 0,
                  activities_count: transformedData.activities.length,
                  activity_entries_count:
                    transformedData.activityEntries.length,
                  friend_count: userData.user?.friend_ids?.length || 0,
                  plan_type: userData.user?.plan_type,
                },
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
    try {
      const startTime = performance.now();
      const result = await smallRetryMechanism(
        async () => {
          const response = await api.get("/timeline");

          return {
            recommendedUsers: response.data.recommended_users,
            recommendedActivities: response.data.recommended_activities,
            recommendedActivityEntries:
              response.data.recommended_activity_entries,
          } as TimelineData;
        },
        {
          shouldRetry: (err) =>
            axios.isAxiosError(err) &&
            (err.response?.status === 404 || err.response?.status === 401),
        }
      );

      const endTime = performance.now();
      const latencySeconds = (endTime - startTime) / 1000;

      const timelineLatencyProperties: Properties = {
        latency_seconds: Math.round(latencySeconds * 1000) / 1000,
      };

      // Use direct capture method
      if (posthog) {
        posthog.capture("timeline-latency", timelineLatencyProperties);
      }

      return result;
    } catch (err) {
      console.error("[UserPlanProvider] Error fetching timeline data:", err);
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
    });

    return query;
  };

  const useRecommendedUsersQuery = () => {
    const query = useQuery({
      queryKey: ["recommendedUsers"],
      queryFn: async () => {
        const startTime = performance.now();
        const response = await api.get("/get-recommended-users");
        const endTime = performance.now();
        const latencySeconds = (endTime - startTime) / 1000;
        const latencyProperties: Properties = {
          latency_seconds: Math.round(latencySeconds * 1000) / 1000,
        };
        if (posthog) {
          posthog.capture("get-recommended-users-latency", latencyProperties);
        }

        return response.data as {
          recommendations: Recommendation[];
          users: User[];
          plans: ApiPlan[];
        };
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

  const useTimelineDataQuery = () => {
    const query = useQuery({
      queryKey: ["timelineData"],
      queryFn: () => fetchTimelineDataFn(),
      enabled: isLoaded && isSignedIn,
    });

    return query;
  };

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
  const timelineDataQuery = useTimelineDataQuery();

  const refetchUserData = async (notify = true) => {
    // Invalidate all user data queries to ensure all components re-render
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
  };

  const refetchAllData = async () => {
    try {
      // Invalidate all relevant queries to ensure all components re-render with fresh data
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["userData"] }),
        queryClient.refetchQueries({ queryKey: ["timelineData"] }),
        queryClient.refetchQueries({ queryKey: ["notificationsData"] }),
        queryClient.refetchQueries({ queryKey: ["messagesData"] }),
        queryClient.refetchQueries({ queryKey: ["recommendedUsers"] }),
        queryClient.refetchQueries({ queryKey: ["multipleUsersData"] }),
        queryClient.refetchQueries({ queryKey: ["metricsAndEntries"] }),
      ]);

      // Wait for the current user data to be refetched and return it
      const userData = await currentUserDataQuery.refetch();
      
      if (userData.error) throw userData.error;
      if (!userData.data) throw new Error("User data is undefined");
      return userData.data;
    } catch (err) {
      toast.error("Failed to refresh data");
      throw err;
    }
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

  const syncUserData = (userData: UserDataEntry) => {
    if (userData?.user?.username) {
      queryClient.invalidateQueries({
        queryKey: ["userData", userData.user.username],
      });
    }
  };

  useEffect(() => {
    if (currentUserDataQuery.data?.user?.username && isSignedIn) {
      const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
        if (
          event.type === "updated" &&
          event.query.queryKey[0] === "userData" &&
          event.query.queryKey[1] === "current"
        ) {
          syncUserData(event.query.state.data as UserDataEntry);
        }
      });

      return () => {
        unsubscribe();
      };
    }
  }, [currentUserDataQuery.data?.user?.username, isSignedIn, queryClient]);

  const currentTheme =
    currentUserDataQuery.data?.user?.theme_base_color || "blue";

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
    notificationsData,
    fetchUserData,
    refetchUserData,
    refetchAllData,
    updateTimezone,
    updateTheme,
    updateLocalUserData: (updater: (data: UserDataEntry) => UserDataEntry) => {
      queryClient.setQueryData(
        ["userData", "current"],
        (oldData: UserDataEntry | undefined) => {
          if (!oldData) return oldData;
          return updater(oldData);
        }
      );
    },
    currentTheme,
    // Add a new function to manually synchronize user data
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
      notificationsData.isPending ||
      notificationsData.isFetching ||
      messagesData.isPending ||
      messagesData.isFetching,
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
