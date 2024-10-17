import React, {
  createContext,
  useContext,
  useState,
  useEffect,
} from "react";
import { useApiWithAuth } from "@/api";
import { parseISO, isSameDay, format } from "date-fns";
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
  name: string;
  username: string;
  plan_ids: string[];
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

interface CompletedSession extends Omit<ActivityEntry, "id"> {}

interface UserPlanContextType {
  user: User | null;
  plans: ApiPlan[];
  setPlans: (plans: ApiPlan[]) => void;
  activities: Activity[];
  activityEntries: ActivityEntry[];
  moodReports: MoodReport[];
  getCompletedSessions: (plan: ApiPlan) => CompletedSession[];
  loading: boolean;
  error: string | null;
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
  const [user, setUser] = useState<User | null>(null);
  const [plans, setPlans] = useState<ApiPlan[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activityEntries, setActivityEntries] = useState<ActivityEntry[]>([]);
  const [moodReports, setMoodReports] = useState<MoodReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isSignedIn } = useSession();
  const { signOut } = useClerk()

  const api = useApiWithAuth();

  useEffect(() => {
    const fetchAllUserData = async () => {
      if (!isSignedIn) return;

      try {
        setLoading(true);
        console.log("GETTING USER DATA")
        const response = await api.get("/api/load-all-user-data");

        setUser(response.data.user);
        setPlans(response.data.plans);
        setActivities(response.data.activities);
        setActivityEntries(response.data.activity_entries);
        setMoodReports(response.data.mood_reports);

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
    };

    fetchAllUserData();
  }, [isSignedIn]);

  const getCompletedSessions = (plan: ApiPlan): CompletedSession[] => {
    if (!plan || !activityEntries.length) return [];

    return plan.sessions
      .filter((session) =>
        activityEntries.some(
          (entry) =>
            isSameDay(parseISO(session.date), parseISO(entry.date)) &&
            session.activity_name.toLowerCase() ===
              activities
                .find((a) => a.id === entry.activity_id)
                ?.title.toLowerCase()
        )
      )
      .map((session) => ({
        date: session.date,
        activity_id:
          activities.find(
            (a) => a.title.toLowerCase() === session.activity_name.toLowerCase()
          )?.id || "",
        quantity: session.quantity,
      }));
  };

  return (
    <UserPlanContext.Provider
      value={{
        user,
        plans,
        setPlans,
        activities,
        activityEntries,
        moodReports,
        getCompletedSessions,
        loading,
        error,
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
