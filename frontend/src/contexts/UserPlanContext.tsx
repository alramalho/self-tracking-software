import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useApiWithAuth } from "@/api";
import { parseISO, isSameDay, format, addMinutes } from "date-fns";
import { useSession } from "@clerk/clerk-react";
import { toast } from "react-hot-toast";
import { Router } from "lucide-react";
import { useRouter } from "next/navigation";

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

export interface Plan {
  id?: string;
  emoji?: string;
  goal: string;
  finishing_date?: Date;
  invitees?: {
    user_id: string;
    username: string;
    name: string;
    picture: string;
  }[];
  sessions: {
    date: Date;
    descriptive_guide: string;
    quantity: number;
    activity_id?: string;
  }[];
}

export interface GeneratedPlan extends Omit<Plan, "invitees">{
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

export interface UserDataEntry {
  user: User | null;
  plans: ApiPlan[];
  activities: Activity[];
  activityEntries: ActivityEntry[];
  moodReports: MoodReport[];
  friendRequests: FriendRequest[];
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
  getCompletedSessions: (plan: ApiPlan, username?: string) => Promise<CompletedSession[]>;
  loading: boolean;
  error: string | null;
  fetchUserData: (username?: string) => Promise<void>;
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

  const api = useApiWithAuth();

  useEffect(() => {
    fetchUserData();
    fetchTimelineData();
  }, []);

  const fetchUserData = async (username: string = "me") => {
      if (!isSignedIn) return;

      try {
        if (userData[username]) {
          return;
        }
        setLoading(true);
        const response = await api.get(`/api/load-all-user-data/${username}`);

        const newUserData: UserDataEntry = {
          user: response.data.user,
          plans: response.data.plans,
          activities: response.data.activities,
          activityEntries: response.data.activity_entries,
          moodReports: response.data.mood_reports,
          friendRequests: response.data.friend_requests,
          expiresAt: addMinutes(new Date(), 10).toISOString(),
        };

        setAllUserData((prevData) => ({
          ...prevData,
          [username]: newUserData,
        }));

        console.log("Fetched user data:", response.data);
      } catch (err: unknown) {
        console.error("Error fetching data:", err);
        router.push("/")
        toast.error("Failed to fetch user data. Please try again.");
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
      const response = await api.get('/api/timeline');

      const newTimelineData: TimelineData = {
        recommendedUsers: response.data.recommended_users,
        recommendedActivities: response.data.recommended_activities,
        recommendedActivityEntries: response.data.recommended_activity_entries,
        expiresAt: addMinutes(new Date(), 10).toISOString(),
      };

      setTimelineData(newTimelineData);

      console.log("Fetched timeline data:", response.data);
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

  const getCompletedSessions = (async (plan: ApiPlan, username: string = "me"): Promise<CompletedSession[]> => {
    if (!plan) return [];

    console.log(`Fetching completed sessions for ${username}`);

    await fetchUserData(username);

    const userDataEntry = userData[username];
    if (!userDataEntry || !userDataEntry.activityEntries.length) return [];

    return plan.sessions
      .filter((session) =>
        userDataEntry.activityEntries.some(
          (entry) =>
            isSameDay(parseISO(session.date), parseISO(entry.date)) &&
            session.activity_id ===
              userDataEntry.activities
                .find((a) => a.id === entry.activity_id)?.id
        )
      )
      .map((session) => ({
        date: session.date,
        activity_id: session.activity_id,
        quantity: session.quantity,
      } as CompletedSession));
  });

  return (
    <UserPlanContext.Provider
      value={{
        userData,
        timelineData,
        setUserData: (username: string, data: UserDataEntry) =>
          setAllUserData((prevData) => ({ ...prevData, [username]: data })),
        setTimelineData,
        getCompletedSessions,
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
