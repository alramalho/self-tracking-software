import React, { createContext, useContext, useState, useEffect } from "react";
import { useApiWithAuth } from "@/api";
import { parseISO } from "date-fns";

interface User {
  id: string;
  name: string;
  selected_plan_id: string | null;
}

export interface Plan {
  goal: string;
  finishing_date?: Date;
  sessions: {
    date: Date;
    descriptive_guide: string;
    quantity: number;
    activity_name: string;
  }[];
  activities: { id: string, title: string; measure: string }[];
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
interface UserPlanContextType {
  user: User | null;
  plan: ApiPlan | null;
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const api = useApiWithAuth();

  useEffect(() => {
    const fetchUserAndPlan = async () => {
      try {
        const userResponse = await api.get("/api/user");
        const userData: User = userResponse.data;
        setUser(userData);

        if (userData.selected_plan_id) {
          const planResponse = await api.get(
            `/api/plans/${userData.selected_plan_id}`
          );
          const planData: ApiPlan = planResponse.data;
          setPlan(planData);
        }
      } catch (err) {
        setError("Failed to fetch user and plan data");
      } finally {
        setLoading(false);
      }
    };

    fetchUserAndPlan();
  }, [api]);

  return (
    <UserPlanContext.Provider value={{ user, plan, loading, error }}>
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
