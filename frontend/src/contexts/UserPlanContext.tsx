import React, {
  createContext,
  useContext,
  useState,
  useEffect,
} from "react";
import { useApiWithAuth } from "@/api";
import { parseISO, isSameDay, format, addMinutes } from "date-fns";
import { useSession } from "@clerk/clerk-react";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import axios from "axios";

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
  image: {
    s3_path?: string;
    url?: string;
    expires_at?: string;
    created_at?: string;
    keep_in_profile?: boolean;
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
  pending_friend_requests: string[];
}

interface FriendRequest {
  id: string;
  sender_id: string;
  sender_username: string;
  sender_name: string;
  sender_picture: string;
  recipient_id: string;
  recipient_username: string;
  recipient_name: string;
  recipient_picture: string;
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
}

export interface GeneratedPlan extends Omit<Plan, "members">{
  overview: string;
  activities: { id: string; emoji: string; title: string; measure: string }[];
  intensity: string;
}

export interface ApiPlan extends Omit<Plan, "finishing_date" | "sessions"> {
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
export interface UserDataEntry {
  user: User | null;
  user_friends?: {picture: string, name: string, username: string}[];
  plans: ApiPlan[];
  planGroups: PlanGroup[];
  activities: Activity[];
  activityEntries: ActivityEntry[];
  moodReports: MoodReport[];
  friendRequests: FriendRequest[];
  notifications: Notification[];
  expiresAt: string;
}

export interface TimelineData {
  recommendedUsers?: User[];
  recommendedActivities?: Activity[];
  recommendedActivityEntries?: ActivityEntry[];
  expiresAt: string;
}

export interface UserData {
  [username: string]: UserDataEntry;
}

interface UserPlanContextType {
  userData: UserData;
  timelineData: TimelineData | null;
  setUserData: (username: string, data: UserDataEntry) => void;
  setTimelineData: (data: TimelineData) => void;
  loading: boolean;
  error: string | null;
  fetchUserData: (options?: {username?: string, forceUpdate?: boolean}) => Promise<void>;
  fetchTimelineData: () => Promise<void>;
}

const UserPlanContext = createContext<UserPlanContextType | undefined>(
  undefined
);

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

export const UserPlanProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [userData, setAllUserData] = useState<UserData>({});
  const [timelineData, setTimelineData] = useState<TimelineData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isSignedIn } = useSession();
  const router = useRouter();
  const { signOut } = useClerk();

  const api = useApiWithAuth();

  useEffect(() => {
    fetchUserData();
    fetchTimelineData();
  }, []);


  const fetchUserData = async ({username = "me", forceUpdate = false}: {username?: string, forceUpdate?: boolean} = {}) => {
      if (!isSignedIn) return;

      try {
        if (userData[username] && !forceUpdate) {
          return;
        }
        setLoading(true);
        const response = await api.get(`/load-all-user-data/${username}`);
        const notificationsResponse = await api.get('/load-notifications');

        const newUserData: UserDataEntry = {
          user: response.data.user,
          plans: response.data.plans,
          planGroups: response.data.plan_groups,
          activities: response.data.activities,
          activityEntries: response.data.activity_entries,
          moodReports: response.data.mood_reports,
          friendRequests: response.data.friend_requests,
          notifications: notificationsResponse.data.notifications,
          expiresAt: addMinutes(new Date(), 10).toISOString(),
        };

        setAllUserData((prevData) => ({
          ...prevData,
          [username]: newUserData,
        }));

      } catch (err: unknown) {
        console.error("Error fetching data:", err);
        if (axios.isAxiosError(err) && err.response?.status === 401) {
          router.push("/signin");
          toast.error("You are not authorized to access this page. Please log in again.", {
            icon: '🔒',
            duration: 5000,
          });
          signOut();
        } else {
          router.push("/");
          toast.error("Failed to fetch user data. Please try again.");
        }
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("An unknown error occurred");
        }
      } finally {
        setLoading(false);
    }
  };

  const fetchTimelineData = async () => {
    if (!isSignedIn) return;

    try {
      if (timelineData) return;

      setLoading(true);
      const response = await api.get('/timeline');

      const newTimelineData: TimelineData = {
        recommendedUsers: response.data.recommended_users,
        recommendedActivities: response.data.recommended_activities,
        recommendedActivityEntries: response.data.recommended_activity_entries,
        expiresAt: addMinutes(new Date(), 10).toISOString(),
      };

      setTimelineData(newTimelineData);

    } catch (err: unknown) {
      console.error("Error fetching timeline data:", err);
      toast.error("Failed to fetch timeline data. Please try again.");
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unknown error occurred");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <UserPlanContext.Provider
      value={{
        userData,
        timelineData,
        setUserData: (username: string, data: UserDataEntry) =>
          setAllUserData((prevData) => ({ ...prevData, [username]: data })),
        setTimelineData,
        loading,
        error,
        fetchUserData,
        fetchTimelineData,
      }}
    >
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
