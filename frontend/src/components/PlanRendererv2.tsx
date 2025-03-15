import { useState, useEffect, useMemo, useCallback } from "react";
import {
  format,
  parseISO,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  isAfter,
  isBefore,
  subDays,
} from "date-fns";
import {
  ApiPlan,
  useUserPlan,
  UserDataEntry,
  convertApiPlanToPlan,
} from "@/contexts/UserPlanContext";
import { BarChart } from "@/components/charts/bar";
import { Loader2, PlusSquare } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import {
  SmallActivityEntryCard,
  Entry,
} from "@/components/SmallActivityEntryCard";
import PlanActivityEntriesRenderer from "./PlanActivityEntriesRenderer";
import PlanSessionsRenderer from "./PlanSessionsRenderer";
import { Switch } from "./ui/switch";
import Link from "next/link";
import { Button } from "./ui/button";
import { WeeklyCompletionCard } from "./WeeklyCompletionCard";
import { WeeklySessionsChecklist } from "./WeeklySessionsChecklist";
import { MilestoneOverview } from "./MilestoneOverview";
import { useApiWithAuth } from "@/api";
import { usePlanEdit } from "@/hooks/usePlanEdit";
import { PlanEditModal } from "./PlanEditModal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

interface PlanRendererv2Props {
  selectedPlan: ApiPlan;
}

export function PlanRendererv2({ selectedPlan }: PlanRendererv2Props) {
  const { useCurrentUserDataQuery, useMultipleUsersDataQuery, fetchUserData } =
    useUserPlan();
  const currentUserDataQuery = useCurrentUserDataQuery();
  const { data: userData } = currentUserDataQuery;
  const [loading, setLoading] = useState(true);
  const { showEditModal, setShowEditModal, handleEditPlan } = usePlanEdit();
  const [openedFromMilestone, setOpenedFromMilestone] = useState(false);
  const api = useApiWithAuth();
  const [timeRange, setTimeRange] = useState<"recent" | "all">("recent");
  const [sessionData, setSessionData] = useState<
    { week: string; [key: string]: number | string }[]
  >([]);
  const [displayFutureActivities, setDisplayFutureActivities] = useState(false);

  const getStartDate = useCallback(() => {
    if (timeRange === "recent") {
      return subDays(new Date(), 30);
    }
    // For "all", find the earliest date between plan start and first activity
    return undefined;
  }, [timeRange, selectedPlan.sessions]);

  // Get usernames of all plan group members except current user
  const memberUsernames = useMemo(() => {
    if (!selectedPlan.plan_group_id || !userData?.user?.username) return [];

    const group = userData?.planGroups.find(
      (group) => group.id === selectedPlan.plan_group_id
    );

    return (group?.members || [])
      .map((member) => member.username)
      .filter((username) => username !== userData?.user?.username);
  }, [selectedPlan.plan_group_id, userData]);

  const { data: membersData } = useMultipleUsersDataQuery(memberUsernames);

  // Replace getUserData function with this helper
  const getMemberData = (username: string): UserDataEntry | undefined => {
    if (username === userData?.user?.username) return userData;
    return membersData?.[username];
  };

  // Get current user's activities
  const activities = useMemo(() => {
    return userData?.activities || [];
  }, [userData]);

  const activityEntries = useMemo(() => {
    return userData?.activityEntries || [];
  }, [userData]);

  // Get plan group members and their associated plans
  const { planGroupMembers, memberPlans } = useMemo(() => {
    if (!selectedPlan.plan_group_id)
      return { planGroupMembers: [], memberPlans: new Map() };

    const group = userData?.planGroups.find(
      (group) => group.id === selectedPlan.plan_group_id
    );

    // Fetch data for all members except current user
    group?.members?.forEach((member) => {
      if (member.username !== userData?.user?.username) {
        fetchUserData({ username: member.username });
      }
    });

    // Get each member's plan from the plan group
    const memberPlans = new Map<string, ApiPlan>();
    group?.members?.forEach((member) => {
      const memberData = getMemberData(member.username);
      const memberPlan = memberData?.plans.find(
        (p) => p.plan_group_id === selectedPlan.plan_group_id
      );
      if (memberPlan) {
        memberPlans.set(member.username, memberPlan);
      }
    });

    return {
      planGroupMembers: group?.members || [],
      memberPlans,
    };
  }, [selectedPlan, userData?.planGroups, membersData]);

  // Add this helper function near the top of the component
  const getCompletedSessionsForPlan = useCallback(
    (plan: ApiPlan, startDate?: Date, endDate?: Date) => {
      const userId = plan.user_id;
      const username = planGroupMembers.find(
        (m) => m.user_id === userId
      )?.username;
      if (!username) return [];

      const memberData = getMemberData(username);
      if (!memberData) return [];

      let completedEntries = memberData.activityEntries.filter((entry) =>
        plan.activity_ids?.includes(entry.activity_id)
      );

      // Filter by date range if provided
      if (startDate && endDate) {
        completedEntries = completedEntries.filter((entry) => {
          const entryDate = parseISO(entry.date);
          return entryDate >= startDate && entryDate <= endDate;
        });
      }

      // Group entries by date and take only one per day
      const entriesByDate = completedEntries.reduce((acc, entry) => {
        const dateKey = format(parseISO(entry.date), 'yyyy-MM-dd');
        if (!acc[dateKey]) {
          acc[dateKey] = entry;
        }
        return acc;
      }, {} as { [key: string]: typeof completedEntries[0] });

      return Object.values(entriesByDate);
    },
    [userData, planGroupMembers, membersData]
  );

  // Modify the useEffect for session data calculation
  useEffect(() => {
    const calculateSessionData = () => {
      setLoading(true);
      if (!selectedPlan || !selectedPlan.plan_group_id) {
        setLoading(false);
        return;
      }

      // Get all plans in the group
      const groupPlans = planGroupMembers
        .map((member) => {
          const memberData = getMemberData(member.username);
          return memberData?.plans.find(
            (p) => p.plan_group_id === selectedPlan.plan_group_id
          );
        })
        .filter((p): p is ApiPlan => p !== undefined);

      // Get all dates from plans and completed entries
      const allDates = [
        ...groupPlans.flatMap((plan) => {
          return plan.sessions.map((s) => parseISO(s.date));
        }),
        ...groupPlans.flatMap((plan) =>
          getCompletedSessionsForPlan(plan).map((e) => parseISO(e.date))
        ),
      ].sort((a, b) => a.getTime() - b.getTime());

      if (allDates.length === 0) {
        setLoading(false);
        return;
      }

      // Calculate weekly data
      const startDate = timeRange === "recent" 
        ? subDays(new Date(), 30) 
        : subWeeks(startOfWeek(allDates[0]), 1);
      const endDate = addWeeks(endOfWeek(allDates[allDates.length - 1]), 1);
      const weeklyData: {
        [key: string]: { [username: string]: number; planned: number };
      } = {};

      let currentWeek = startDate;
      while (currentWeek <= endDate) {
        const weekKey = format(currentWeek, "yyyy-MM-dd");
        const weekEnd = endOfWeek(currentWeek);

        // Skip weeks before startDate for "recent" view
        if (timeRange === "recent" && isBefore(weekEnd, startDate)) {
          currentWeek = addWeeks(currentWeek, 1);
          continue;
        }

        weeklyData[weekKey] = { planned: 0 };

        // Calculate planned sessions for this week
        if (selectedPlan.outline_type === "times_per_week") {
          weeklyData[weekKey].planned = selectedPlan.times_per_week || 0;
        } else {
          const plannedThisWeek = selectedPlan.sessions.filter((session) => {
            const sessionDate = parseISO(session.date);
            return sessionDate >= currentWeek && sessionDate <= weekEnd;
          }).length;
          weeklyData[weekKey].planned += plannedThisWeek;
        }

        // Calculate data for each user in the plan group
        groupPlans.forEach((plan) => {
          const member = planGroupMembers.find(
            (m) => m.user_id === plan.user_id
          );
          if (!member) return;

          // Count completed sessions this week
          const completedThisWeek = getCompletedSessionsForPlan(
            plan,
            currentWeek,
            weekEnd
          ).length;
          weeklyData[weekKey][member.username] = completedThisWeek;
        });

        currentWeek = addWeeks(currentWeek, 1);
      }

      // Format data for chart
      const formattedData = Object.entries(weeklyData).map(([week, data]) => ({
        week: format(parseISO(week), "MMM d, yyyy"),
        planned: data.planned,
        ...Object.fromEntries(
          planGroupMembers.map((member) => [
            member.username,
            data[member.username] || 0,
          ])
        ),
      }));
      setSessionData(formattedData);
      setLoading(false);
    };

    calculateSessionData();
  }, [selectedPlan, userData, membersData, timeRange, getStartDate]);

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
      .filter(
        (entry) =>
          entry.activity_id === session.activity_id &&
          parseISO(entry.date) >= weekStart &&
          parseISO(entry.date) <= weekEnd
      )
      .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());

    const sessionIndex = plannedSessionsThisWeek.findIndex(
      (s) => s.date === session.date
    );
    return completedSessionsThisWeek.length > sessionIndex;
  };

  const getCompletedOn = (session: ApiPlan["sessions"][0]) => {
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
      .filter(
        (entry) =>
          entry.activity_id === session.activity_id &&
          parseISO(entry.date) >= weekStart &&
          parseISO(entry.date) <= weekEnd
      )
      .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());

    const sessionIndex = plannedSessionsThisWeek.findIndex(
      (s) => s.date === session.date
    );

    return completedSessionsThisWeek[sessionIndex]?.date
      ? parseISO(completedSessionsThisWeek[sessionIndex]?.date)
      : undefined;
  };

  // Add this helper function near other helper functions
  const areAllWeeklyActivitiesCompleted = useCallback(() => {
    const currentWeekStart = startOfWeek(new Date());
    const currentWeekEnd = endOfWeek(new Date());

    const thisWeekSessions = selectedPlan.sessions.filter((session) => {
      const sessionDate = parseISO(session.date);
      return sessionDate >= currentWeekStart && sessionDate <= currentWeekEnd;
    });

    return (
      thisWeekSessions.length > 0 &&
      thisWeekSessions.every((session) => isSessionCompleted(session))
    );
  }, [selectedPlan.sessions, isSessionCompleted]);

  return (
    <div>
      <div className="flex flex-row items-center justify-start gap-2 mb-8">
        <span className="text-4xl">{selectedPlan.emoji}</span>
        <h2 className="text-2xl font-semibold mt-2">{selectedPlan.goal}</h2>
      </div>
      {selectedPlan.milestones && selectedPlan.milestones.length > 0 && (
        <div className="mb-8">
          <MilestoneOverview
            milestones={selectedPlan.milestones}
            planId={selectedPlan.id}
            onEdit={() => {
              setOpenedFromMilestone(true);
              setShowEditModal(true);
            }}
          />
        </div>
      )}

      <div className="flex flex-row justify-between items-center mb-4">
        <span className="text-sm text-gray-500">Time range</span>
        <Select
          value={timeRange}
          onValueChange={(value: "recent" | "all") => setTimeRange(value)}
        >
          <div className="bg-white font-semibold text-gray-800">
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Since 30 days ago</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </div>
        </Select>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex flex-row items-center justify-start gap-2 mb-2">
          <span className="text-4xl">🎯</span>
          <h2 className="text-xl font-semibold mt-2">Activities Overview</h2>
        </div>

        {selectedPlan.outline_type === "times_per_week" && (
          <WeeklySessionsChecklist
            plan={selectedPlan}
            activityEntries={activityEntries}
          />
        )}

        {selectedPlan.outline_type === "specific" &&
          areAllWeeklyActivitiesCompleted() && <WeeklyCompletionCard />}

        {selectedPlan.outline_type === "specific" && (
          <>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-800">This week</h2>

              <span className="text-sm text-gray-500 ">
                Completed activities are calculated on a per week count basis.
              </span>
            </div>
            <div className="flex flex-row flex-wrap gap-4">
              {selectedPlan.sessions
                .filter((session) => {
                  const sessionDate = parseISO(session.date);
                  const endOfCurrentWeek = endOfWeek(new Date());
                  const beginningOfCurrentWeek = startOfWeek(new Date());
                  return (
                    isAfter(sessionDate, beginningOfCurrentWeek) &&
                    isBefore(sessionDate, endOfCurrentWeek)
                  );
                })
                .map((session) => {
                  const activity = activities.find(
                    (a) => a.id === session.activity_id
                  );
                  const completed = isSessionCompleted(session);
                  const completedOn = getCompletedOn(session);
                  if (!activity) return null;

                  return (
                    <SmallActivityEntryCard
                      key={`${session.date}-${session.activity_id}`}
                      entry={session as Entry}
                      activity={activity}
                      completed={completed}
                      completedOn={completedOn}
                    />
                  );
                })}
            </div>
          </>
        )}
        <div className="mt-4">
          {selectedPlan.outline_type === "specific" && (
            <div className="flex flex-row flex-nowrap items-center gap-2 mb-4">
              <span className="text-xs text-gray-500">Completed</span>
              <Switch
                data-testid="display-future-activities-switch"
                checked={displayFutureActivities}
                onCheckedChange={setDisplayFutureActivities}
              />
              <span className="text-xs text-gray-500">Planned</span>
            </div>
          )}
          {displayFutureActivities ? (
            <PlanSessionsRenderer
              plan={convertApiPlanToPlan(
                selectedPlan,
                activities.filter((a) =>
                  selectedPlan.activity_ids?.includes(a.id)
                )
              )}
              activities={activities.filter((a) =>
                selectedPlan.activity_ids?.includes(a.id)
              )}
              startDate={getStartDate()}
            />
          ) : (
            <PlanActivityEntriesRenderer
              plan={convertApiPlanToPlan(selectedPlan, activities)}
              activities={activities}
              activityEntries={activityEntries}
              startDate={getStartDate()}
            />
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center mt-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading session data...</span>
        </div>
      ) : (
        sessionData.length > 0 && (
          <div className="mt-4">
            <BarChart
              data={sessionData}
              xAxisKey="week"
              lines={[
                {
                  dataKey: "planned",
                  name: "Planned Sessions",
                  color: "hsl(var(--chart-1))",
                },
                ...planGroupMembers
                  .filter(
                    (member) =>
                      member.username !== userData?.user?.username &&
                      member.username
                  )
                  .map((member, index) => ({
                    dataKey: member.username,
                    name: `${member.name}'s Sessions`,
                    color: `hsl(var(--chart-${index + 2}))`,
                  })),
                // Add current user last
                ...(userData?.user?.username
                  ? [
                      {
                        dataKey: userData.user.username,
                        name: "Your Sessions",
                        color: `hsl(var(--chart-${
                          planGroupMembers.filter(
                            (member) =>
                              member.username !== userData?.user?.username
                          ).length + 2
                        }))`,
                      },
                    ]
                  : []),
              ]}
              title={`Sessions Overview 📈`}
              description={`${sessionData[0].week} - ${
                sessionData[sessionData.length - 1].week
              }`}
              currentDate={new Date()}
            />
          </div>
        )
      )}

      {planGroupMembers && planGroupMembers.length >= 2 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 mt-4">
          <h2 className="text-lg font-semibold mb-2">People in this plan</h2>
          <div className="flex flex-row flex-wrap gap-6">
            {planGroupMembers.map((member) => (
              <div
                key={member.user_id}
                className="flex flex-row flex-nowrap gap-2 items-center"
              >
                <Link href={`/profile/${member.username}`}>
                  <Avatar className="w-12 h-12 text-2xl">
                    <AvatarImage
                      src={member.picture || ""}
                      alt={member.name || member.username}
                    />
                    <AvatarFallback>{member.name?.[0] || "U"}</AvatarFallback>
                  </Avatar>
                </Link>
                <div className="text-lg text-gray-800">
                  {userData?.user?.username === member.username
                    ? "You"
                    : member.name}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Link href="/add" passHref>
        <Button
          variant="outline"
          className="bg-gray-50 mt-4 w-full h-[100px] flex flex-col items-center justify-center border-2 border-dashed border-gray-300 text-gray-500"
        >
          <PlusSquare className="h-8 w-8 mb-2 text-gray-400" />
          <span>Log Activity</span>
        </Button>
      </Link>

      <PlanEditModal
        plan={selectedPlan}
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setOpenedFromMilestone(false);
        }}
        onConfirm={(updatedPlan) => handleEditPlan(selectedPlan, updatedPlan)}
        scrollToMilestones={openedFromMilestone}
      />
    </div>
  );
}
