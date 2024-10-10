import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
} from "react";
import { useApiWithAuth } from "@/api";
import { parseISO, isSameDay } from "date-fns";

export interface Activity {
  id: string;
  title: string;
  measure: string;
  emoji?: string; // Include this if your backend provides emojis
}

export interface ActivityEntry {
  id: string;
  activity_id: string;
  quantity: number;
  date: string;
}

interface User {
  id: string;
  name: string;
  selected_plan_id: string | null;
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

interface CompletedSession {
  date: Date;
  activity_id: string;
  quantity: number;
}

interface UserPlanContextType {
  user: User | null;
  plan: ApiPlan | null;
  activities: Activity[];
  activityEntries: ActivityEntry[];
  completedSessions: CompletedSession[]; // Add this line
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

export const UserPlanProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [plan, setPlan] = useState<ApiPlan | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activityEntries, setActivityEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const api = useApiWithAuth();

  useEffect(() => {
    const fetchUserPlanAndActivities = async () => {
      try {
        const [userResponse, activitiesResponse, activityEntriesResponse] =
          await Promise.all([
            api.get("/api/user"),
            api.get("/api/activities"),
            api.get("/api/activity-entries"),
          ]);

        const userData: User = userResponse.data;
        setUser(userData);
        setActivities(activitiesResponse.data);
        setActivityEntries(activityEntriesResponse.data);

        console.log({ activities: activitiesResponse.data });
        console.log({ activityEntries: activityEntriesResponse.data });
        if (userData.selected_plan_id) {
          const planResponse = await api.get(
            `/api/plans/${userData.selected_plan_id}`
          );
          const planData: ApiPlan = planResponse.data;
          setPlan(planData);
          console.log({ plan: planData });
        }
      } catch (err) {
        setError(
          "Failed to fetch user, plan, activities, and activity entries data"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchUserPlanAndActivities();
  }, []);

  const completedSessions = useMemo(() => {
    if (!plan || !activityEntries.length) return [];

    const result2 = plan.sessions.filter((session) =>
      activityEntries.some((entry) => {
        console.log({ session: session.date, entry: entry.date });
        return (
          isSameDay(parseISO(session.date), parseISO(entry.date)) &&
          session.activity_name.toLowerCase() ===
            activities.find((a) => a.id === entry.activity_id)?.title.toLowerCase()
        );
      })
    );
    const result = result2.map((session) => ({
      date: parseISO(session.date),
      activity_id:
        activities.find((a) => a.title === session.activity_name)?.id || "",
      quantity: session.quantity,
    }));

    console.log({ intermediate: result2 });
    console.log({ completedSessions: result });
    return result;
  }, [plan, activityEntries, activities]);

  return (
    <UserPlanContext.Provider
      value={{
        user,
        plan,
        activities,
        activityEntries,
        completedSessions,
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
