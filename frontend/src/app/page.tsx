"use client";

import { useSession } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApiWithAuth } from "@/api";
import Link from "next/link";
import { Loader2, Plus } from "lucide-react";
import { convertPlanToApiPlan, Plan, useUserPlan } from "@/contexts/UserPlanContext";
import { LineChart } from "@/components/charts/line";
import { format, parseISO, startOfWeek, addWeeks, isToday, isAfter } from "date-fns";
import { Button } from "@/components/ui/button";
import AppleLikePopover from "@/components/AppleLikePopover";
import { ApiPlan } from "@/contexts/UserPlanContext";
import Onboarding from "@/components/Onboarding";
import toast from "react-hot-toast";

interface User {
  id: string;
  name: string;
  plan_ids: string[];
}

export default function Home() {
  const { isSignedIn } = useSession();
  const { loading, user, plans, setPlans, getCompletedSessions } = useUserPlan();
  const router = useRouter();
  const [selectedPlanId, setSelectedPlanId] = useState<string | undefined>(undefined);
  const [sessionData, setSessionData] = useState<{ week: string; planned: number; completed: number | null }[]>([]);
  const [isCreatingNewPlan, setIsCreatingNewPlan] = useState(false);

  useEffect(() => {
    if (isSignedIn && user) {
      if (user.plan_ids.length === 0) {
        router.push("/onboarding");
      }
    }
  }, [isSignedIn, user]);

  useEffect(() => {
    if (selectedPlanId && plans.length > 0) {
      const selectedPlan = plans.find(plan => plan.id === selectedPlanId);
      if (!selectedPlan) return;

      const completedSessions = getCompletedSessions(selectedPlan);
      const currentDate = new Date();

      const allDates = [...selectedPlan.sessions.map(s => parseISO(s.date)), ...completedSessions.map(s => parseISO(s.date))]
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
        if (selectedPlan.sessions.some(s => parseISO(s.date).getTime() === date.getTime())) {
          cumulativePlanned += 1;
        }
        if (completedSessions.some(s => parseISO(s.date).getTime() === date.getTime())) {
          // Only increment completed if the date is not after the current date
          if (!isAfter(date, currentDate)) {
            cumulativeCompleted += 1;
          }
        }
        weeklyData[weekKey].planned = cumulativePlanned;
        weeklyData[weekKey].completed = cumulativeCompleted;
      });

      const formattedData = Object.entries(weeklyData).map(([week, data]) => ({
        week: format(parseISO(week), 'MMM d'),
        planned: data.planned,
        completed: isAfter(parseISO(week), currentDate) ? null : data.completed,
        fullDate: week
      }));
      setSessionData(formattedData);
    }
  }, [selectedPlanId, plans, getCompletedSessions]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span>Loading your data...</span>
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

  const renderPlanCard = (plan: ApiPlan) => (
    <div
      key={plan.id}
      className={`grid grid-cols-[auto,1fr] gap-4 p-6 rounded-lg border-2 cursor-pointer hover:bg-gray-50 ${
        selectedPlanId === plan.id ? 'border-blue-500' : 'border-gray-200'
      }`}
      onClick={() => setSelectedPlanId(plan.id)}
    >
      {plan.emoji && (
        <span className="text-6xl">{plan.emoji}</span>
      )}
      <div className="flex flex-col">
        <span className="text-xl font-medium">
          {plan.goal}
        </span>
        <span className="text-sm text-gray-500 mt-2">
          📍 {plan.finishing_date ? new Date(plan.finishing_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
        </span>
      </div>
    </div>
  );

  const handleNewPlanComplete = (newPlan: Plan) => {
    setPlans([...plans, convertPlanToApiPlan(newPlan)]);
    setSelectedPlanId(newPlan.id);
    setIsCreatingNewPlan(false);
    toast.success("New plan created successfully!");
  };

  return (
    <div className="container mx-auto px-4 py-8 flex flex-col">
      {isCreatingNewPlan ? (
        <Onboarding isNewPlan={true} onComplete={handleNewPlanComplete} />
      ) : (
        <>
          <h1 className="text-3xl font-bold mb-6">Your Plans</h1>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {plans.map(renderPlanCard)}
            <Button
              variant="outline"
              className="h-full flex flex-col items-center justify-center"
              onClick={() => setIsCreatingNewPlan(true)}
            >
              <Plus className="h-8 w-8 mb-2" />
              <span>Create New Plan</span>
            </Button>
          </div>

          {sessionData.length > 0 && (
            <div className="mt-8 max-w-4xl">
              <LineChart 
                data={sessionData.map(item => ({
                  ...item,
                  completed: item.completed ?? 0
                }))}
                xAxisKey="week"
                lines={[
                  { dataKey: "planned", name: "Planned Sessions", color: "hsl(var(--chart-1))" },
                  { dataKey: "completed", name: "Completed Sessions", color: "hsl(var(--chart-2))" }
                ]}
                title="Sessions Overview"
                description={`${sessionData[0].week} - ${sessionData[sessionData.length - 1].week}`}
                currentDate={new Date()} 
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}