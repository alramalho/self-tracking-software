import React, { createContext, useContext } from "react";
import { useApiWithAuth } from "@/api";
import { parseISO, format, addMinutes, differenceInDays } from "date-fns";
import { useSession } from "@clerk/clerk-react";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import axios from "axios";
import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { usePostHog } from "posthog-js/react";
export interface Activity {
  id: string;
  title: string;
  measure: string;
  emoji?: string;
  user_id?: string;
}

export interface ActivityEntry {
  id: string;
  activity_id: string;
  quantity: number;
  date: string;
  reactions?: Record<string, string[]>; // emoji -> usernames
  image?: {
    s3_path?: string;
    url?: string;
    expires_at?: string;
    created_at?: string;
    is_public?: boolean;
  };
}

export interface CompletedSession extends Omit<ActivityEntry, "id" | "image"> {}

export interface MoodReport {
  id: string;
  user_id: string;
  date: string;
  score: string;
}

export interface User {
  id: string;
  name?: string;
  picture?: string;
  username?: string;
  email: string;
  plan_ids: string[];
  friend_ids: string[];
  referred_user_ids: string[];
  pending_friend_requests: string[];
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

export interface Plan {
  id?: string;
  user_id?: string;
  emoji?: string;
  goal: string;
  finishing_date?: Date;
  plan_group_id?: string;
  sessions: {
    date: Date;
    descriptive_guide: string;
    quantity: number;
    activity_id?: string;
    activity_name?: string;
  }[];
  notes?: string;
  duration_type?: "habit" | "lifestyle" | "custom";
}

export interface GeneratedPlan extends Omit<Plan, "finishing_date" | "members">{
  overview: string;
  finishing_date?: string;
  activities: { id: string; emoji: string; title: string; measure: string }[];
  intensity: string;
}

export interface ApiPlan extends Omit<Plan, "id" | "finishing_date" | "sessions"> {
  id: string;
  finishing_date?: string;
  sessions: {
    date: string;
    descriptive_guide: string;
    quantity: number;
    activity_id: string;
  }[];
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

type Emotion = {
  name: string;
  score: number;
  color: string;
};
export interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
  emotions: Emotion[];
}

export interface UserDataEntry {
  user: User | null;
  user_friends?: {picture: string, name: string, username: string}[];
  plans: ApiPlan[];
  planGroups: PlanGroup[];
  activities: Activity[];
  activityEntries: ActivityEntry[];
  moodReports: MoodReport[];
  sentFriendRequests: FriendRequest[];
  receivedFriendRequests: FriendRequest[];
  notifications: Notification[];
  expiresAt: string;
  messages: Message[];
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

interface UserPlanContextType {
  useUserDataQuery: (username: string) => UseQueryResult<UserDataEntry>;
  useMultipleUsersDataQuery: (usernames: string[]) => UseQueryResult<Record<string, UserDataEntry>>;
  hasLoadedUserData: boolean; 
  hasLoadedTimelineData: boolean;
  timelineData: UseQueryResult<TimelineData | null>;
  fetchUserData: (options?: {username?: string, forceUpdate?: boolean}) => Promise<UserDataEntry>;
  refetchUserData: () => Promise<UserDataEntry>;
  refetchAllData: () => Promise<UserDataEntry>;
}

const UserPlanContext = createContext<UserPlanContextType | undefined>(undefined);

export function convertGeneratedPlanToPlan(plan: GeneratedPlan): Plan {
  return {
    ...plan,
    finishing_date: plan.finishing_date ? parseISO(plan.finishing_date) : undefined,
  } as Plan;
}

export function convertGeneratedPlanToApiPlan(plan: GeneratedPlan): ApiPlan {
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

export function convertApiPlanToPlan(plan: ApiPlan, planActivities: Activity[]): Plan {
  return {
    ...plan,
    finishing_date: plan.finishing_date ? parseISO(plan.finishing_date) : undefined,
    sessions: plan.sessions.map((session) => ({
      ...session,
      date: parseISO(session.date),
      activity_name: planActivities.find(a => a.id === session.activity_id)?.title,
    })),
  } as Plan;
}

export function convertPlanToApiPlan(plan: Plan): ApiPlan {
  return convertGeneratedPlanToApiPlan(plan as GeneratedPlan);
}

export const UserPlanProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isSignedIn } = useSession();
  const router = useRouter();
  const { signOut } = useClerk();
  const api = useApiWithAuth();
  const posthog = usePostHog();

  const fetchUserData = async ({username = "me"}: {username?: string} = {}): Promise<UserDataEntry> => {
    if (!isSignedIn) {
      throw new Error("User not signed in");
    }

    try {
      const response = await api.get('/load-users-data', {
        params: { usernames: username }
      });
      
      const userData = response.data[username];
      
      if (!userData) {
        console.error('No user data found in response:', response.data);
        throw new Error('No user data found in response');
      }

      const notificationsResponse = username === "me" 
        ? await api.get('/load-notifications')
        : { data: { notifications: [] } };

      const transformedData: UserDataEntry = {
        user: userData.user || null,
        plans: userData.plans || [],
        planGroups: userData.plan_groups || [],
        activities: userData.activities || [],
        activityEntries: userData.activity_entries || [],
        moodReports: userData.mood_reports || [],
        sentFriendRequests: userData.sent_friend_requests || [],
        receivedFriendRequests: userData.received_friend_requests || [],
        notifications: notificationsResponse.data.notifications || [],
        expiresAt: addMinutes(new Date(), 10).toISOString(),
        messages: userData.messages || [],
      };

      console.log('Transformed User Data:', transformedData);

      return transformedData;
    } catch (err: unknown) {
      console.error('Error in fetchUserData:', err);
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        router.push("/signin");
        toast.error("You are not authorized to access this page. Please log in again.", {
          icon: '🔒',
          duration: 5000,
        });
        signOut({ redirectUrl: window.location.pathname });
        posthog.reset()
      } else {
        router.push("/");
        toast.error("Failed to fetch user data. Please try again.");
      }
      throw err;
    }
  };

  const fetchTimelineDataFn = async () => {
    if (!isSignedIn) return null;

    try {
      const response = await api.get('/timeline');
      return {
        recommendedUsers: response.data.recommended_users,
        recommendedActivities: response.data.recommended_activities,
        recommendedActivityEntries: response.data.recommended_activity_entries,
        expiresAt: addMinutes(new Date(), 10).toISOString(),
      } as TimelineData;
    } catch (err) {
      toast.error("Failed to fetch timeline data. Please try again.");
      throw err;
    }
  };

  const useUserDataQuery = (username: string) => useQuery({
    queryKey: ['userData', username],
    queryFn: () => fetchUserData({ username }),
    enabled: isSignedIn,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const timelineData = useQuery({
    queryKey: ['timelineData'],
    queryFn: fetchTimelineDataFn,
    enabled: isSignedIn,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const useMultipleUsersDataQuery = (usernames: string[]) => useQuery({
    queryKey: ['multipleUsersData', usernames.sort().join(',')],
    queryFn: async () => {
      const response = await api.get('/load-users-data', {
        params: { usernames: usernames.join(',') }
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
          messages: typedValue.messages || [],
        };
      }
      return transformedData;
    },
    enabled: isSignedIn && usernames.length > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const userDataQuery = useUserDataQuery("me");

  const refetchUserData = async () => {
    return toast.promise(
      userDataQuery.refetch().then(result => {
        if (result.error) throw result.error;
        if (!result.data) throw new Error("User data is undefined");
        return result.data;
      }),
      {
        loading: 'Updating...',
        success: 'Updated successfully',
        error: 'Failed to update'
      }
    );
  };

  const refetchAllData = async () => {
    return toast.promise(
      Promise.all([
        userDataQuery.refetch(),
        timelineData.refetch()
      ]).then(([userData, timeline]) => {
        if (userData.error) throw userData.error;
        if (!userData.data) throw new Error("User data is undefined");
        return userData.data;
      }),
      {
        loading: 'Refreshing all data...',
        success: 'All data refreshed successfully',
        error: 'Failed to refresh data'
      }
    );
  };

  const context = {
    userDataQuery,
    useUserDataQuery,
    useMultipleUsersDataQuery,
    hasLoadedUserData: userDataQuery.isSuccess && !!userDataQuery.data,
    hasLoadedTimelineData: timelineData.isSuccess,
    timelineData,
    fetchUserData,
    refetchUserData,
    refetchAllData
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
