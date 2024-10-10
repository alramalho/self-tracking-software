"use client";

import { useSession } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApiWithAuth } from "@/api";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useUserPlan } from "@/contexts/UserPlanContext";
import { LineChart } from "@/components/charts/line";
import { format, parseISO, startOfWeek, addWeeks } from "date-fns";

interface User {
  id: string;
  name: string;
  selected_plan_id: string | null;
}

export default function Home() {
  const { isSignedIn } = useSession();
  const { plan: userPlan, completedSessions } = useUserPlan();
  const router = useRouter();
  const api = useApiWithAuth();
  const [loading, setLoading] = useState(true);
  const [sessionData, setSessionData] = useState<{ week: string; planned: number; completed: number }[]>([]);

  useEffect(() => {
    const checkUserAndRedirect = async () => {
      try {
        const response = await api.get("/api/user");
        const user: User = response.data;
        if (!user.selected_plan_id) {
          router.push("/onboarding");
        }
      } catch (error) {
        console.error("Error fetching user:", error);
        setLoading(false);
      }
    };
    if (userPlan != null) {
      setLoading(false);
      if (isSignedIn) {
        checkUserAndRedirect();
      }
    }
  }, [isSignedIn, userPlan]);

  useEffect(() => {
    if (userPlan && userPlan.sessions && completedSessions) {
      const allDates = [...userPlan.sessions.map(s => parseISO(s.date)), ...completedSessions.map(s => s.date)]
        .sort((a, b) => a.getTime() - b.getTime());

      if (allDates.length === 0) return;

      const startDate = startOfWeek(allDates[0]);
      const endDate = allDates[allDates.length - 1];

      let currentWeek = startDate;
      const weeklyData: { [key: string]: { planned: number; completed: number } } = {};

      while (currentWeek <= endDate) {
        const weekKey = format(currentWeek, 'yyyy-MM-dd');
        weeklyData[weekKey] = { planned: 0, completed: 0 };
        currentWeek = addWeeks(currentWeek, 1);
      }

      let cumulativePlanned = 0;
      let cumulativeCompleted = 0;

      allDates.forEach(date => {
        const weekKey = format(startOfWeek(date), 'yyyy-MM-dd');
        if (userPlan.sessions.some(s => parseISO(s.date).getTime() === date.getTime())) {
          cumulativePlanned += 1;
        }
        if (completedSessions.some(s => s.date.getTime() === date.getTime())) {
          cumulativeCompleted += 1;
        }
        weeklyData[weekKey].planned = cumulativePlanned;
        weeklyData[weekKey].completed = cumulativeCompleted;
      });

      const formattedData = Object.entries(weeklyData).map(([week, data]) => ({
        week: format(parseISO(week), 'MMM d'),
        planned: data.planned,
        completed: data.completed
      }));
      setSessionData(formattedData);
    }
  }, [userPlan, completedSessions]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-4xl mb-4">Welcome to tracking.so</h1>
        <Link
          href="/signin"
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 flex flex-col">
      <h1 className="text-3xl font-bold mb-6">Your Plan</h1>
      {userPlan ? (
        <div className="grid grid-cols-[auto,1fr] gap-4 p-6 rounded-lg border-2">
          {userPlan.emoji && (
            <span className="text-6xl self-center">{userPlan.emoji}</span>
          )}
          <div className="flex flex-col">
            <span className="text-xl font-medium">
              {userPlan.goal}
            </span>
            <span className="text-sm text-gray-500 mt-2">
              📍 {userPlan.finishing_date ? new Date(userPlan.finishing_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
            </span>
          </div>
        </div>
      ) : (
        <p>No plan selected. Please complete the onboarding process.</p>
      )}

      {sessionData.length > 0 && (
        <div className="mt-8">
          <LineChart 
            data={sessionData}
            xAxisKey="week"
            lines={[
              { dataKey: "planned", name: "Planned Sessions", color: "hsl(var(--chart-1))" },
              { dataKey: "completed", name: "Completed Sessions", color: "hsl(var(--chart-2))" }
            ]}
            title="Cumulative Weekly Sessions"
            description={`${sessionData[0].week} - ${sessionData[sessionData.length - 1].week}`}
          />
        </div>
      )}
    </div>
  );
}