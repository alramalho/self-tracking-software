import { useState, useEffect } from "react";
import {
  format,
  parseISO,
  isAfter,
  isToday,
  isBefore,
  isFuture,
  startOfWeek,
  addWeeks,
  subWeeks,
} from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import {
  ApiPlan,
  Activity,
  useUserPlan,
  CompletedSession,
} from "@/contexts/UserPlanContext";
import { LineChart } from "@/components/charts/line";
import { Loader2 } from "lucide-react";

interface PlanRendererv2Props {
  selectedPlan: ApiPlan;
  activities: Activity[];
  completedSessions: { [username: string]: CompletedSession[] };
  loadingSessions: boolean;
}

export function PlanRendererv2({
  selectedPlan,
  activities,
  completedSessions,
  loadingSessions,
}: PlanRendererv2Props) {
  const [sessionData, setSessionData] = useState<
    { week: string; planned: number; [key: string]: number | string }[]
  >([]);
  const [selectedSession, setSelectedSession] = useState<
    ApiPlan["sessions"][0] | null
  >(null);

  useEffect(() => {
    if (selectedPlan) {
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

      const currentDate = new Date();

      const allDates = [
        ...selectedPlan.sessions.map((s) => parseISO(s.date)),
        ...Object.values(completedSessions)
          .flat()
          .map((s) => parseISO(s.date)),
      ].sort((a, b) => a.getTime() - b.getTime());

      if (allDates.length === 0) return;

      // Start the chart one week before the first session date
      const startDate = subWeeks(startOfWeek(allDates[0]), 1);
      const endDate = allDates[allDates.length - 1];

      let currentWeek = startDate;
      const weeklyData: {
        [key: string]: { planned: number; [key: string]: number };
      } = {};

      while (currentWeek <= endDate) {
        const weekKey = format(currentWeek, "yyyy-MM-dd");
        weeklyData[weekKey] = { planned: 0 };
        Object.keys(completedSessions).forEach((username) => {
          weeklyData[weekKey][username] = 0;
        });
        currentWeek = addWeeks(currentWeek, 1);
      }

      let cumulativePlanned = 0;
      const cumulativeCompleted: { [key: string]: number } = {};
      Object.keys(completedSessions).forEach((username) => {
        cumulativeCompleted[username] = 0;
      });

      allDates.forEach((date) => {
        const weekKey = format(startOfWeek(date), "yyyy-MM-dd");
        if (
          selectedPlan.sessions.some(
            (s) => parseISO(s.date).getTime() === date.getTime()
          )
        ) {
          cumulativePlanned += 1;
        }
        Object.entries(completedSessions).forEach(([username, sessions]) => {
          if (
            sessions.some((s) => parseISO(s.date).getTime() === date.getTime())
          ) {
            if (!isAfter(date, currentDate)) {
              cumulativeCompleted[username] += 1;
            }
          }
        });
        weeklyData[weekKey].planned = cumulativePlanned;
        Object.keys(completedSessions).forEach((username) => {
          weeklyData[weekKey][username] = cumulativeCompleted[username];
        });
      });

      const formattedData = Object.entries(weeklyData).map(([week, data]) => ({
        week: format(parseISO(week), "MMM d, yyyy"),
        planned: data.planned,
        ...Object.keys(completedSessions).reduce(
          (acc, username) => ({
            ...acc,
            [username]: isAfter(parseISO(week), currentDate)
              ? null
              : data[username],
          }),
          {}
        ),
        fullDate: week,
      }));
      setSessionData(formattedData);
    }
  }, [selectedPlan, completedSessions]);

  const prepareCalendarData = (plan: ApiPlan) => {
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
          📆 {format(sessionDate, "EEEE, MMMM d")}
        </h3>
        <ul className="list-disc list-inside mb-2">
          <li>
            {session.quantity} {activity?.measure} of {activity?.title}
          </li>
        </ul>
        <p className="text-sm text-gray-600">{session.descriptive_guide}</p>
      </div>
    );
  };

  return (
    <div>
      {sessionData.length > 0 && (
        <div className="mt-8 max-w-4xl">
          {loadingSessions && (
            <div className="flex items-center gap-2">
              <Loader2 className="animate-spin" />
              <span>Loading your friends plan data...</span>
            </div>
          )}
          {!loadingSessions && (
            <LineChart
              data={sessionData}
              xAxisKey="week"
              lines={[
                {
                  dataKey: "planned",
                  name: "Planned Sessions",
                  color: "hsl(var(--chart-1))",
                },
                ...Object.keys(completedSessions).map((username, index) => ({
                  dataKey: username,
                  name: `${username}'s Completed Sessions`,
                  color: `hsl(var(--chart-${index + 2}))`,
                })),
              ]}
              title="Sessions Overview"
              description={`${sessionData[0].week} - ${
                sessionData[sessionData.length - 1].week
              }`}
              currentDate={new Date()}
            />
          )}
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-4">Upcoming Sessions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            {selectedSession && (
              <>
                {renderSessionDetails(
                  selectedSession,
                  activities.find((a) => a.id === selectedSession.activity_id)
                )}
              </>
            )}
          </div>
          <Calendar
            mode="multiple"
            selected={prepareCalendarData(selectedPlan).dates}
            className="rounded-md border"
            components={{
              Day: ({ date, ...props }) => {
                const { sessionsMap } = prepareCalendarData(selectedPlan);
                const sessionDate = format(date, "yyyy-MM-dd");
                const session = sessionsMap.get(sessionDate);

                return (
                  <div
                    className={cn(
                      "h-9 w-9 p-0 font-normal aria-selected:opacity-100",
                      "relative flex items-center justify-center",
                      session &&
                        isFuture(date) &&
                        "bg-blue-100 h-9 w-9 rounded-full cursor-pointer",
                      isToday(date) && "font-extrabold",
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
    </div>
  );
}
