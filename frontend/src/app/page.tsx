"use client";

import { useSession } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Plus } from "lucide-react";
import {
  Activity,
  convertPlanToApiPlan,
  Plan,
  useUserPlan,
} from "@/contexts/UserPlanContext";
import { LineChart } from "@/components/charts/line";
import {
  format,
  parseISO,
  startOfWeek,
  addWeeks,
  isToday,
  isAfter,
  isBefore,
} from "date-fns";
import { Button } from "@/components/ui/button";
import { ApiPlan } from "@/contexts/UserPlanContext";
import Onboarding from "@/components/Onboarding";
import toast from "react-hot-toast";
import { Calendar } from "@/components/ui/calendar";
import { isFuture } from "date-fns";
import { cn } from "@/lib/utils";
import { useClerk } from "@clerk/nextjs";

export default function Home() {
  const { isSignedIn, isLoaded } = useSession();
  const {
    loading,
    user,
    plans,
    activities,
    error,
    setPlans,
    getCompletedSessions,
  } = useUserPlan();
  const router = useRouter();
  const [selectedPlanId, setSelectedPlanId] = useState<string | undefined>(
    undefined
  );
  const [sessionData, setSessionData] = useState<
    { week: string; planned: number; completed: number | null }[]
  >([]);
  const [isCreatingNewPlan, setIsCreatingNewPlan] = useState(false);
  const { signOut } = useClerk();
  const [selectedSession, setSelectedSession] = useState<
    ApiPlan["sessions"][0] | null
  >(null);

  useEffect(() => {
    if (isLoaded && isSignedIn && user && user.plan_ids.length === 0) {
      router.push("/onboarding");
    }
  }, [isLoaded, isSignedIn, user, router]);

  useEffect(() => {
    if (selectedPlanId && plans.length > 0) {
      const selectedPlan = plans.find((plan) => plan.id === selectedPlanId);
      if (!selectedPlan) return;

      const now = new Date();
      const nextSession = selectedPlan.sessions
        .map((session) => ({ ...session, date: parseISO(session.date) }))
        .filter(
          (session) => isAfter(session.date, now) || isToday(session.date)
        )
        .sort((a, b) => a.date.getTime() - b.date.getTime())[0];

      setSelectedSession(
        nextSession
          ? { ...nextSession, date: format(nextSession.date, "yyyy-MM-dd") }
          : null
      );

      const completedSessions = getCompletedSessions(selectedPlan);
      const currentDate = new Date();

      const allDates = [
        ...selectedPlan.sessions.map((s) => parseISO(s.date)),
        ...completedSessions.map((s) => parseISO(s.date)),
      ].sort((a, b) => a.getTime() - b.getTime());

      if (allDates.length === 0) return;

      const startDate = startOfWeek(allDates[0]);
      const endDate = allDates[allDates.length - 1];

      let currentWeek = startDate;
      const weeklyData: {
        [key: string]: { planned: number; completed: number };
      } = {};

      while (currentWeek <= endDate) {
        const weekKey = format(currentWeek, "yyyy-MM-dd");
        weeklyData[weekKey] = { planned: 0, completed: 0 };
        currentWeek = addWeeks(currentWeek, 1);
      }

      let cumulativePlanned = 0;
      let cumulativeCompleted = 0;

      allDates.forEach((date) => {
        const weekKey = format(startOfWeek(date), "yyyy-MM-dd");
        if (
          selectedPlan.sessions.some(
            (s) => parseISO(s.date).getTime() === date.getTime()
          )
        ) {
          cumulativePlanned += 1;
        }
        if (
          completedSessions.some(
            (s) => parseISO(s.date).getTime() === date.getTime()
          )
        ) {
          // Only increment completed if the date is not after the current date
          if (!isAfter(date, currentDate)) {
            cumulativeCompleted += 1;
          }
        }
        weeklyData[weekKey].planned = cumulativePlanned;
        weeklyData[weekKey].completed = cumulativeCompleted;
      });

      const formattedData = Object.entries(weeklyData).map(([week, data]) => ({
        week: format(parseISO(week), "MMM d"),
        planned: data.planned,
        completed: isAfter(parseISO(week), currentDate) ? null : data.completed,
        fullDate: week,
      }));
      setSessionData(formattedData);
    }
  }, [selectedPlanId, plans, getCompletedSessions]);

  if (!isLoaded || loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span>Loading your data...</span>
      </div>
    );
  }

  if (error) {
    const handleSignOut = async () => {
      await signOut();
      window.location.href = "/signin";
    };

    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-4xl mb-4">An error occurred</h1>
        <p>{error}</p>
        <button
          onClick={handleSignOut}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mt-4 mb-2"
        >
          Try signing in again
        </button>
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
        selectedPlanId === plan.id ? "border-blue-500" : "border-gray-200"
      }`}
      onClick={() => setSelectedPlanId(plan.id)}
    >
      {plan.emoji && <span className="text-6xl">{plan.emoji}</span>}
      <div className="flex flex-col">
        <span className="text-xl font-medium">{plan.goal}</span>
        <span className="text-sm text-gray-500 mt-2">
          📍{" "}
          {plan.finishing_date
            ? new Date(plan.finishing_date).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })
            : ""}
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

  const prepareCalendarData = (plan: ApiPlan | undefined) => {
    if (!plan) return { dates: [], sessionsMap: new Map() };

    const sessions = plan.sessions.map((session) => ({
      ...session,
      date: parseISO(session.date),
    }));
    const dates = sessions.map((session) => session.date);
    const sessionsMap = new Map(
      sessions.map((session) => [format(session.date, "yyyy-MM-dd"), session])
    );

    return { dates, sessionsMap };
  };

  const renderSessionDetails = (
    session: ApiPlan["sessions"][0],
    activity: Activity | undefined
  ) => {
    const sessionDate =
      typeof session.date === "string" ? parseISO(session.date) : session.date;

    return (
      <div className="mb-4 p-4 bg-gray-100 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">
          {format(sessionDate, "MMMM d, yyyy")}
        </h3>
        <ul className="list-disc list-inside mb-2">
          <li>
            {session.quantity} {activity?.measure} of {session.activity_name}
          </li>
        </ul>
        <p className="text-sm text-gray-600">{session.descriptive_guide}</p>
      </div>
    );
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
                data={sessionData.map((item) => ({
                  ...item,
                  completed: item.completed ?? 0,
                }))}
                xAxisKey="week"
                lines={[
                  {
                    dataKey: "planned",
                    name: "Planned Sessions",
                    color: "hsl(var(--chart-1))",
                  },
                  {
                    dataKey: "completed",
                    name: "Completed Sessions",
                    color: "hsl(var(--chart-2))",
                  },
                ]}
                title="Sessions Overview"
                description={`${sessionData[0].week} - ${
                  sessionData[sessionData.length - 1].week
                }`}
                currentDate={new Date()}
              />
            </div>
          )}

          {selectedPlanId && (
            <div className="mt-8">
              <h2 className="text-2xl font-bold mb-4">Upcoming Sessions</h2>
              <div className="flex flex-row gap-8 flex-wrap">
                {selectedSession && (
                  <>
                    {renderSessionDetails(
                      selectedSession,
                      activities.find(
                        (a) =>
                          a.title.toLowerCase() ===
                          selectedSession.activity_name.toLowerCase()
                      )
                    )}
                  </>
                )}
                <Calendar
                  mode="multiple"
                  selected={
                    prepareCalendarData(
                      plans.find((p) => p.id === selectedPlanId)
                    ).dates
                  }
                  className="rounded-md border w-[280px]"
                  components={{
                    Day: ({ date, ...props }) => {
                      const { sessionsMap } = prepareCalendarData(
                        plans.find((p) => p.id === selectedPlanId)
                      );
                      const sessionDate = format(date, "yyyy-MM-dd");
                      const session = sessionsMap.get(sessionDate);

                      return (
                        <div
                          className={cn(
                            "h-9 w-9 p-0 font-normal aria-selected:opacity-100",
                            "relative flex items-center justify-center",
                            session &&
                              isFuture(date) &&
                              "bg-blue-100 h-9 w-9 rounded-full",
                            session &&
                              isToday(date) &&
                              "bg-red-100 h-9 w-9 rounded-full",
                            isBefore(date, new Date()) &&
                              !isToday(date) &&
                              "text-gray-400"
                          )}
                          {...props}
                          onClick={() => {
                            if (session && (isFuture(date) || isToday(date))) {
                              setSelectedSession({
                                ...session,
                                date: format(
                                  typeof session.date === "string"
                                    ? parseISO(session.date)
                                    : session.date,
                                  "yyyy-MM-dd"
                                ),
                              });
                            }
                          }}
                        >
                          <span>{date.getDate()}</span>
                        </div>
                      );
                    },
                  }}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
