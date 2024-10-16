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
} from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { ApiPlan, Activity } from "@/contexts/UserPlanContext";
import { LineChart } from "@/components/charts/line";

interface PlanRendererv2Props {
  selectedPlan: ApiPlan;
  activities: Activity[];
  getCompletedSessions: (plan: ApiPlan) => { date: string }[];
}

export function PlanRendererv2({
  selectedPlan,
  activities,
  getCompletedSessions,
}: PlanRendererv2Props) {
  const [sessionData, setSessionData] = useState<
    { week: string; planned: number; completed: number | null }[]
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
  }, [selectedPlan, getCompletedSessions]);

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
            {session.quantity} {activity?.measure} of {session.activity_name}
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

      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-4">Upcoming Sessions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
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
    </div>
  );
}
