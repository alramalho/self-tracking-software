import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useApiWithAuth } from "@/api";
import { parseISO, isSameDay, format, addDays, addSeconds } from "date-fns";
import { useSession } from "@clerk/clerk-react";
import { useClerk } from "@clerk/nextjs";
import { toast } from 'react-hot-toast';

export interface Activity {
  id: string;
  title: string;
  measure: string;
  emoji?: string;
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
  }
}

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
  sessions: {
    date: Date;
    descriptive_guide: string;
    quantity: number;
    activity_name: string;
  }[];
  activities: { id: string; title: string; measure: string }[];
  intensity: string;
  overview: string;
}

export interface ApiPlan extends Omit<Plan, "finishing_date" | "sessions"> {
  finishing_date?: string;
  sessions: {
    date: string;
    descriptive_guide: string;
    quantity: number;
    activity_name: string;
  }[];
}

interface CompletedSession extends Omit<ActivityEntry, "id" | "image"> {}

export interface UserData {
  user: User | null;
  plans: ApiPlan[];
  activities: Activity[];
  activityEntries: ActivityEntry[];
  moodReports: MoodReport[];
  friendRequests: FriendRequest[];
  expiresAt: string;
}

interface UserPlanContextType {
  userData: { [username: string]: UserData };
  setUserData: (username: string, data: UserData) => void;
  getCompletedSessions: (plan: ApiPlan) => CompletedSession[];
  loading: boolean;
  error: string | null;
  fetchUserData: (username?: string) => Promise<void>;
}

const UserPlanContext = createContext<UserPlanContextType | undefined>(
  undefined
);

export function convertApiPlansToPlans(apiPlans: ApiPlan[]): Plan[] {
  return apiPlans.map((apiPlan) => ({
    ...apiPlan,
    finishing_date: apiPlan.finishing_date
      ? parseISO(apiPlan.finishing_date)
      : undefined,
    sessions: apiPlan.sessions.map((session) => ({
      ...session,
      date: parseISO(session.date),
      activity_name: session.activity_name,
    })),
  }));
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
  const [userData, setUserData] = useState<{ [username: string]: UserData }>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isSignedIn } = useSession();

  const api = useApiWithAuth();

  useEffect(() => {
    localStorage.setItem("userData", JSON.stringify(userData));
  }, [userData]);

  const fetchUserData = useCallback(async (username: string = 'me') => {
    if (!isSignedIn) return;

    try {
      setLoading(true);
      console.log("GETTING USER DATA");

      // Check if data exists in local storage and is not expired
      const storedData = localStorage.getItem(`userData_${username || 'me'}`);
      if (storedData) {
        const parsedData = JSON.parse(storedData);
        if (new Date(parsedData.expiresAt) > new Date()) {
          setUserData(prevData => ({
            ...prevData,
            [username]: parsedData
          }));
          setLoading(false);
          return;
        }
      }

      const response = await api.get(`/api/load-all-user-data/${username}`);

      const newUserData: UserData = {
        user: response.data.user,
        plans: response.data.plans,
        activities: response.data.activities,
        activityEntries: response.data.activity_entries,
        moodReports: response.data.mood_reports,
        friendRequests: response.data.friend_requests,
        expiresAt: addSeconds(new Date(), 1).toISOString(),
      };

      setUserData(prevData => ({
        ...prevData,
        [username || 'me']: newUserData
      }));

      // Store in local storage
      localStorage.setItem(`userData_${username || 'me'}`, JSON.stringify(newUserData));

      console.log("Fetched user data:", response.data);
    } catch (err: unknown) {
      console.error("Error fetching data:", err);
      toast.error("Failed to fetch user data. Please try again.");
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unknown error occurred");
      }
    } finally {
      setLoading(false);
    }
  }, [isSignedIn]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  const getCompletedSessions = (plan: ApiPlan): CompletedSession[] => {
    const currentUserData = userData['me'];
    if (!currentUserData || !plan || !currentUserData.activityEntries.length) return [];

    return plan.sessions
      .filter((session) =>
        currentUserData.activityEntries.some(
          (entry) =>
            isSameDay(parseISO(session.date), parseISO(entry.date)) &&
            session.activity_name.toLowerCase() ===
              currentUserData.activities
                .find((a) => a.id === entry.activity_id)
                ?.title.toLowerCase()
        )
      )
      .map((session) => ({
        date: session.date,
        activity_id:
          currentUserData.activities.find(
            (a) => a.title.toLowerCase() === session.activity_name.toLowerCase()
          )?.id || "",
        quantity: session.quantity,
      }));
  };

  return (
    <UserPlanContext.Provider
      value={{
        userData,
        setUserData: (username: string, data: UserData) => 
          setUserData(prevData => ({ ...prevData, [username]: data })),
        getCompletedSessions,
        loading,
        error,
        fetchUserData,
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
