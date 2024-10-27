import { useState, useEffect, useMemo } from "react";
import {
  format,
  parseISO,
  isToday,
  isBefore,
  isFuture,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
} from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import {
  ApiPlan,
  Activity,
  useUserPlan,
} from "@/contexts/UserPlanContext";
import { LineChart } from "@/components/charts/line";
import { Loader2, Check } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import {
  ActivityEntryCard,
  Entry,
} from "@/components/ActivityEntryCard";

interface PlanRendererv2Props {
  selectedPlan: ApiPlan;
  activities: Activity[];
}

export function PlanRendererv2({
  selectedPlan,
  activities,
}: PlanRendererv2Props) {
  const { userData } = useUserPlan();
  const [sessionData, setSessionData] = useState<
    { week: string; planned: number; completed: number }[]
  >([]);
  const [selectedSession, setSelectedSession] = useState<
    ApiPlan["sessions"][0] | null
  >(null);
  const [loading, setLoading] = useState(true);

  const activityEntries = userData.me?.activityEntries || [];

  const completedActivityEntries = activityEntries.filter((entry) =>
    selectedPlan.sessions.some(
      (session) => session.activity_id === entry.activity_id
    )
  );

  const selectedPlanGroupMembers = useMemo(() => {
    console.log({userDataPlanGroupsIds: userData.me?.planGroups.map(group => group.id)});
    console.log({selectedPlanPlanGroupId: selectedPlan.plan_group_id});
    const result = selectedPlan.plan_group_id ? userData.me?.planGroups.find(group => group.id === selectedPlan.plan_group_id)?.members : [];
    console.log({selectedPlanGroupMembers: result});
    return result
  }, [userData]);

  useEffect(() => {
    const calculateSessionData = () => {
      setLoading(true);
      if (!selectedPlan) {
        setLoading(false);
        return;
      }

      const allDates = [
        ...selectedPlan.sessions.map((s) => parseISO(s.date)),
        ...completedActivityEntries.map((e) => parseISO(e.date)),
      ].sort((a, b) => a.getTime() - b.getTime());

      if (allDates.length === 0) return;

      const startDate = subWeeks(startOfWeek(allDates[0]), 1);
      const endDate = addWeeks(endOfWeek(allDates[allDates.length - 1]), 1);

      let currentWeek = startDate;
      const weeklyData: {
        [key: string]: { planned: number; completed: number };
      } = {};

      while (currentWeek <= endDate) {
        const weekKey = format(currentWeek, "yyyy-MM-dd");
        weeklyData[weekKey] = { planned: 0, completed: 0 };
        currentWeek = addWeeks(currentWeek, 1);
      }

      selectedPlan.sessions.forEach((session) => {
        const sessionDate = parseISO(session.date);
        const weekKey = format(startOfWeek(sessionDate), "yyyy-MM-dd");
        weeklyData[weekKey].planned += 1;
      });

      completedActivityEntries.forEach((entry) => {
        const entryDate = parseISO(entry.date);
        const weekKey = format(startOfWeek(entryDate), "yyyy-MM-dd");
        if (weeklyData[weekKey]) {
          weeklyData[weekKey].completed += 1;
        }
      });

      const formattedData = Object.entries(weeklyData).map(([week, data]) => ({
        week: format(parseISO(week), "MMM d, yyyy"),
        planned: data.planned,
        completed: data.completed,
      }));

      setSessionData(formattedData);
      setLoading(false);
    };

    calculateSessionData();
  }, [selectedPlan]);

  const isSessionCompleted = (session: ApiPlan["sessions"][0]) => {
    const sessionDate = parseISO(session.date);
    const weekStart = startOfWeek(sessionDate);
    const weekEnd = endOfWeek(sessionDate);

    const plannedSessionsThisWeek = selectedPlan.sessions
      .filter((s) => {
        const sDate = parseISO(s.date);
        return (
          s.activity_id === session.activity_id &&
          sDate >= weekStart &&
          sDate <= weekEnd
        );
      })
      .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());

    const completedSessionsThisWeek = activityEntries
      .filter((entry) => {
        const entryDate = parseISO(entry.date);
        return (
          entry.activity_id === session.activity_id &&
          entryDate >= weekStart &&
          entryDate <= weekEnd
        );
      })
      .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());

    const sessionIndex = plannedSessionsThisWeek.findIndex(
      (s) => s.date === session.date
    );
    return completedSessionsThisWeek.length > sessionIndex;
  };

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

  // Sort activity entries by date (most recent first) and limit to 7
  const recentActivityEntries = completedActivityEntries
    .sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime())
    .slice(0, 7);

  return (
    <div>
      {selectedPlanGroupMembers && selectedPlanGroupMembers.length > 0 && (
        <>
          <h2 className="text-lg font-semibold mb-2">People in this plan</h2>
          {selectedPlanGroupMembers.map((member) => (
            <div
              key={member.user_id} 
              className="flex flex-row flex-nowrap gap-2 items-center"
            >
              <Avatar className="w-16 h-16 text-2xl">
                <AvatarImage
                  src={member.picture || ""}
                  alt={member.name || member.username}
                />
                <AvatarFallback>{member.name?.[0] || "U"}</AvatarFallback>
              </Avatar>
              <div className="text-lg text-gray-800">{userData.me?.user?.username === member.username ? "You" : member.name}</div>
            </div>
          ))}
        </>
      )}
      {loading ? (
        <div className="flex items-center justify-center mt-8">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading session data...</span>
        </div>
      ) : sessionData.length > 0 ? (
        <div className="mt-8 max-w-4xl">
          <LineChart
            data={sessionData}
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
            title={`Sessions Overview ${selectedPlan.emoji}`}
            description={`${sessionData[0].week} - ${
              sessionData[sessionData.length - 1].week
            }`}
            currentDate={new Date()}
          />
        </div>
      ) : null}
      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-4">Activity History</h2>
        <div className="flex flex-row flex-wrap gap-4">
          {recentActivityEntries.map((entry) => {
            const activity = activities.find((a) => a.id === entry.activity_id);
            if (!activity) return null;

            return (
              <ActivityEntryCard
                key={`${entry.date}-${entry.activity_id}`}
                entry={entry}
                activity={activity}
                completed={true}
              />
            );
          })}
        </div>
      </div>

      <div className="mt-8">
        <div className="mb-4">
          <h2 className="text-2xl font-bold">Coming up next</h2>
          <span className="text-sm text-gray-500 ">
            Completed activities are calculated on a per week count basis.
          </span>
        </div>
        <div className="flex flex-row flex-wrap gap-4">
          {selectedPlan.sessions
            .filter((session) => {
              const sessionDate = parseISO(session.date);
              const oneWeekFromNow = addWeeks(new Date(), 1);
              return (
                (isToday(sessionDate) || isFuture(sessionDate)) &&
                isBefore(sessionDate, oneWeekFromNow)
              );
            })
            .map((session) => {
              const activity = activities.find(
                (a) => a.id === session.activity_id
              );
              const completed = isSessionCompleted(session);
              if (!activity) return null;

              return (
                <ActivityEntryCard
                  key={`${session.date}-${session.activity_id}`}
                  entry={session as Entry}
                  activity={activity}
                  onClick={() => setSelectedSession(session)}
                  completed={completed}
                />
              );
            })}
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-4">Calendar</h2>
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
                        "bg-blue-50 h-9 w-9 rounded-full cursor-pointer",
                      session && isFuture(date) && "bg-blue-100",
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
