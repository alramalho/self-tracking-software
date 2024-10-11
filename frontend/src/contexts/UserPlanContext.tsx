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
  activities: Activity[];
  activityEntries: ActivityEntry[];
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

export const UserPlanProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [plans, setPlans] = useState<ApiPlan[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activityEntries, setActivityEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const api = useApiWithAuth();

  useEffect(() => {
    const fetchUserPlansAndActivities = async () => {
      try {
        const [userResponse, plansResponse, activitiesResponse, activityEntriesResponse] =
          await Promise.all([
            api.get("/api/user"),
            api.get("/api/user-plans"),
            api.get("/api/activities"),
            api.get("/api/activity-entries"),
          ]);

        const userData: User = userResponse.data;
        setUser(userData);
        setPlans(plansResponse.data.plans);
        setActivities(activitiesResponse.data);
        setActivityEntries(activityEntriesResponse.data);

        console.log({ activities: activitiesResponse.data });
        console.log({ activityEntries: activityEntriesResponse.data });
        console.log({ plans: plansResponse.data.plans });
      } catch (err) {
        setError(
          "Failed to fetch user, plans, activities, and activity entries data"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchUserPlansAndActivities();
  }, []);

  const getCompletedSessions = (plan: ApiPlan): CompletedSession[] => {
    if (!plan || !activityEntries.length) return [];

    return plan.sessions
      .filter((session) =>
        activityEntries.some((entry) =>
          isSameDay(parseISO(session.date), parseISO(entry.date)) &&
          session.activity_name.toLowerCase() ===
            activities.find((a) => a.id === entry.activity_id)?.title.toLowerCase()
        )
      ).map((session) => ({
        date: session.date,
        activity_id:
          activities.find((a) => a.title.toLowerCase() === session.activity_name.toLowerCase())?.id || "",
        quantity: session.quantity,
      }));
  };

  return (
    <UserPlanContext.Provider
      value={{
        user,
        plans,
        activities,
        activityEntries,
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
