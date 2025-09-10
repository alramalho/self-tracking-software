import { useApiWithAuth } from "@/api";
import { useActivities } from "@/contexts/activities";
import { usePlanProgress } from "@/contexts/PlanProgressContext";
import { CompletePlan, usePlans } from "@/contexts/plans";
import { useCurrentUser } from "@/contexts/users";
import { useThemeColors } from "@/hooks/useThemeColors";
import { getThemeVariants } from "@/utils/theme";
import { addWeeks, endOfWeek, format, isSameWeek, subDays } from "date-fns";
import { ChartArea, Maximize2, Minimize2, PlusSquare } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CoachOverviewCard } from "./CoachOverviewCard";
import { MilestoneOverview } from "./MilestoneOverview";
import PlanActivityEntriesRenderer from "./PlanActivityEntriesRenderer";
import { PlanEditModal } from "./PlanEditModal";
import PlanSessionsRenderer from "./PlanSessionsRenderer";
import { PlanWeekDisplay } from "./PlanWeekDisplay";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Switch } from "./ui/switch";

interface PlanRendererv2Props {
  selectedPlan: CompletePlan;
}

export function PlanRendererv2({ selectedPlan }: PlanRendererv2Props) {
  const { currentUser } = useCurrentUser();
  const { plans } = usePlans();
  const { activities, activityEntries } = useActivities();

  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [openedFromMilestone, setOpenedFromMilestone] = useState(false);
  const api = useApiWithAuth();
  const [timeRange, setTimeRange] = useState<"recent" | "all">("recent");
  const [sessionData, setSessionData] = useState<
    { week: string; [key: string]: number | string }[]
  >([]);
  const [displayFutureActivities, setDisplayFutureActivities] = useState(false);
  const [showAllWeeks, setShowAllWeeks] = useState(false);

  const { plansProgress } = usePlanProgress();
  const planProgress = plansProgress.find((p) => p.plan.id === selectedPlan.id);
  const currentWeekRef = useRef<HTMLDivElement>(null);
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);

  const isPlanCoached = useCallback((selectedPlan: CompletePlan) => {
    if (!plans) return false;
    // we must check if the plan has the minimum .sortOrder of plans
    const minSortOrder = plans.reduce((min, plan) => {
      if (!plan.sortOrder) return Infinity;
      return plan.sortOrder < min ? plan.sortOrder : min;
    }, Infinity) ?? 0;

    return selectedPlan.sortOrder === minSortOrder;
    
  }, [selectedPlan, plans]);

  // Auto-scroll to current week when weeks data loads
  useEffect(() => {
    if (currentWeekRef.current && planProgress?.weeks.length) {
      // Small delay to ensure the layout is complete
      setTimeout(() => {
        currentWeekRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 100);
    }
  }, [planProgress?.weeks.length]);

  const getStartDate = useCallback(() => {
    if (timeRange === "recent") {
      return subDays(new Date(), 30);
    }
    return undefined;
  }, [timeRange, selectedPlan.sessions]);

  // const memberUsernames = useMemo(() => {
  //   if (!selectedPlan.planGroupId || !currentUser?.username) return [];

  //   const group = plans
  //     ?.map((p) => p.planGroup)
  //     .find((group) => group?.id === selectedPlan.planGroupId);

  //   return (group?.members || [])
  //     .map((member) => member.username)
  //     .filter(
  //       (username) =>
  //         username !== null &&
  //         username !== undefined &&
  //         username !== currentUser?.username
  //     );
  // }, [selectedPlan.planGroupId, currentUser]);

  // // const {data: membersData} = useUsers(
  // //   memberUsernames
  // //     .filter((username) => username !== null)
  // //     .map((username) => ({ username }))
  // // );

  // // const getMemberData = (username: string) => {
  // //   if (username === currentUser?.username) return currentUser;
  // //   return membersData?.find((m) => m.username === username);
  // // };

  // // const { planGroupMembers, memberPlans } = useMemo(() => {
  // //   if (!selectedPlan.planGroupId)
  // //     return { planGroupMembers: [], memberPlans: new Map() };

  // //   const group = plans
  // //     ?.map((p) => p.planGroup)
  // //     .find((group) => group?.id === selectedPlan.planGroupId);

  // //   const memberPlans = new Map<string, Plan>();
  // //   group?.members?.forEach((member) => {
  // //     if (member.username === null || member.username === undefined) return;

  // //     const memberData = getMemberData(member.username);
  // //     const memberPlan = memberData?.plans.find(
  // //       (p) => p.planGroupId === selectedPlan.planGroupId
  // //     );
  // //     if (memberPlan) {
  // //       memberPlans.set(member.username, memberPlan);
  // //     }
  // //   });

  // //   return {
  // //     planGroupMembers: group?.members || [],
  // //     memberPlans,
  // //   };
  // // }, [selectedPlan, currentUser?.plans, membersData]);

  // const getCompletedSessionsForPlan = useCallback(
  //   (
  //     plan: Plan & {
  //       sessions: PlanSession[];
  //       activities: Activity[];
  //     },
  //     startDate?: Date,
  //     endDate?: Date
  //   ) => {
  //     const userId = plan.userId;
  //     const username = planGroupMembers.find((m) => m.id === userId)?.username;
  //     if (!username) return [];

  //     const memberData = getMemberData(username);
  //     if (!memberData) return [];

  //     let completedEntries = memberData.activityEntries.filter((entry) =>
  //       plan.activities.map((a) => a.id).includes(entry.activityId)
  //     );

  //     if (startDate && endDate) {
  //       completedEntries = completedEntries.filter((entry) => {
  //         const entryDate = entry.date;
  //         return entryDate >= startDate && entryDate <= endDate;
  //       });
  //     }

  //     const entriesByDate = completedEntries.reduce((acc, entry) => {
  //       const dateKey = format(entry.date, "yyyy-MM-dd");
  //       if (!acc[dateKey]) {
  //         acc[dateKey] = entry;
  //       }
  //       return acc;
  //     }, {} as { [key: string]: (typeof completedEntries)[0] });

  //     return Object.values(entriesByDate);
  //   },
  //   [currentUser, planGroupMembers, membersData]
  // );

  // Filter weeks to show current and next week, or all weeks based on showAllWeeks state
  const weeksToDisplay = useMemo(() => {
    if (!planProgress?.weeks) return [];

    if (showAllWeeks) {
      return planProgress.weeks;
    }

    const currentWeekIndex = planProgress.weeks.findIndex((week) =>
      isSameWeek(week.startDate, new Date(), { weekStartsOn: 0 })
    );

    if (currentWeekIndex === -1) {
      // If no current week found, show first two weeks
      return planProgress.weeks.slice(0, 2);
    }

    // Show current week and next week (if it exists)
    return planProgress.weeks.slice(currentWeekIndex, currentWeekIndex + 2);
  }, [planProgress?.weeks, showAllWeeks]);

  // useEffect(() => {
  //   const calculateSessionData = () => {
  //     setLoading(true);
  //     if (!selectedPlan || !selectedPlan.planGroupId) {
  //       setLoading(false);
  //       return;
  //     }

  //     const groupPlans = selectedPlan.planGroup?.plans || [];

  //     const allDates = [
  //       ...groupPlans.flatMap((plan) => {
  //         return plan.sessions.map((s) => parseISO(s.date));
  //       }),
  //       ...groupPlans.flatMap((plan) =>
  //         getCompletedSessionsForPlan(plan).map((e) => parseISO(e.date))
  //       ),
  //     ].sort((a, b) => a.getTime() - b.getTime());

  //     if (allDates.length === 0) {
  //       setLoading(false);
  //       return;
  //     }

  //     const startDate =
  //       timeRange === "recent"
  //         ? subDays(new Date(), 30)
  //         : subWeeks(startOfWeek(allDates[0]), 1);
  //     const endDate = addWeeks(endOfWeek(allDates[allDates.length - 1]), 1);
  //     const weeklyData: {
  //       [key: string]: { [username: string]: number; planned: number };
  //     } = {};

  //     let currentWeekStart = startOfWeek(startDate);
  //     while (currentWeekStart <= endDate) {
  //       const weekKey = format(currentWeekStart, "yyyy-MM-dd");
  //       const weekEnd = endOfWeek(currentWeekStart);

  //       if (timeRange === "recent" && isBefore(weekEnd, startDate)) {
  //         currentWeekStart = addWeeks(currentWeekStart, 1);
  //         continue;
  //       }

  //       weeklyData[weekKey] = { planned: 0 };

  //       if (selectedPlan.outlineType === "TIMES_PER_WEEK") {
  //         weeklyData[weekKey].planned = selectedPlan.timesPerWeek || 0;
  //       } else {
  //         const plannedThisWeek = selectedplan.sessions?.filter((session) => {
  //           const sessionDate = parseISO(session.date);
  //           return sessionDate >= currentWeekStart && sessionDate <= weekEnd;
  //         }).length;
  //         weeklyData[weekKey].planned += plannedThisWeek;
  //       }

  //       groupPlans.forEach((plan) => {
  //         const member = planGroupMembers.find((m) => m.userId === plan.userId);
  //         if (!member) return;

  //         const completedThisWeek = getCompletedSessionsForPlan(
  //           plan,
  //           currentWeekStart,
  //           weekEnd
  //         ).length;
  //         weeklyData[weekKey][member.username] = completedThisWeek;
  //       });

  //       currentWeekStart = addWeeks(currentWeekStart, 1);
  //     }

  //     const formattedData = Object.entries(weeklyData).map(([week, data]) => ({
  //       week: format(parseISO(week), "MMM d, yyyy"),
  //       planned: data.planned,
  //       ...Object.fromEntries(
  //         planGroupMembers.map((member) => [
  //           member.username,
  //           data[member.username] || 0,
  //         ])
  //       ),
  //     }));
  //     setSessionData(formattedData);
  //     setLoading(false);
  //   };

  //   calculateSessionData();
  // }, [selectedPlan, currentUser, membersData, timeRange, getStartDate]);

  // const areAllWeeklyActivitiesCompleted = useCallback(() => {
  //   const currentWeekStart = startOfWeek(new Date());
  //   const currentWeekEnd = endOfWeek(new Date());

  //   const thisWeekSessions = selectedplan.sessions?.filter((session) => {
  //     const sessionDate = parseISO(session.date);
  //     return sessionDate >= currentWeekStart && sessionDate <= currentWeekEnd;
  //   });

  //   return (
  //     thisWeekSessions.length > 0 &&
  //     thisWeekSessions.every((session) =>
  //       isSessionCompleted(session, selectedPlan, activityEntries)
  //     )
  //   );
  // }, [selectedPlan.sessions]);

  return (
    <div>
      <div className="flex flex-row items-center justify-start gap-2 mb-8">
        <span className="text-4xl">{selectedPlan.emoji}</span>
        <div className="flex flex-col">
          <h2 className="text-2xl font-semibold mt-2">{selectedPlan.goal}</h2>
          <span className="text-sm text-gray-500">
            {selectedPlan.outlineType === "TIMES_PER_WEEK"
              ? `${selectedPlan.timesPerWeek} times per week`
              : `custom plan`}
          </span>
        </div>
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

      <div className="flex flex-col gap-4">
        <div className="flex flex-row items-center justify-between mb-2">
          <div className="flex flex-row items-center justify-start gap-2">
            <ChartArea className={`h-10 w-10 -mt-1 ${variants.text}`} />
            <h2 className="text-xl font-semibold">{isPlanCoached(selectedPlan) ? "Coach Overview" : "Plan Overview"}</h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAllWeeks(!showAllWeeks)}
            className="text-xs flex flex-row items-center gap-1"
          >
            {showAllWeeks ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
            {showAllWeeks ? "Show Current + Next" : "Show All Weeks"}
          </Button>
        </div>
        {isPlanCoached(selectedPlan) && (
          <CoachOverviewCard
            selectedPlan={selectedPlan}
            activities={activities}
          />
        )}
        {weeksToDisplay.map((week, index) => {
          const isCurrentWeek = isSameWeek(week.startDate, new Date(), {
            weekStartsOn: 0,
          });
          const isNextWeek = isSameWeek(
            week.startDate,
            addWeeks(new Date(), 1),
            {
              weekStartsOn: 0,
            }
          );
          const totalWeeks = planProgress?.weeks.length ?? 0;
          const actualWeekIndex =
            planProgress?.weeks.findIndex(
              (w) => w.startDate.getTime() === week.startDate.getTime()
            ) ?? index;
          return (
            <div
              key={actualWeekIndex}
              ref={isCurrentWeek ? currentWeekRef : null}
              className="flex flex-col gap-2 p-3 rounded-2xl bg-white p-2 border border-gray-200"
            >
              <PlanWeekDisplay
                title={
                  <div className="flex justify-between items-center w-full">
                    <span className="text-lg font-semibold">
                      {isCurrentWeek
                        ? "Current week"
                        : isNextWeek
                        ? "Next week"
                        : `Week ${actualWeekIndex + 1} / ${totalWeeks}`}
                    </span>
                    <span className="text-sm text-gray-500">
                      {format(week.startDate, "d")}-
                      {format(endOfWeek(week.startDate), "d MMM")}
                    </span>
                  </div>
                }
                plan={selectedPlan}
                date={week.startDate}
              />
            </div>
          );
        })}
      </div>

      <div className="flex flex-row items-center justify-start gap-2 mb-2 mt-6">
        <span className="text-4xl">🎯</span>
        <h2 className="text-xl font-semibold mt-2">Full Activities Overview</h2>
      </div>
      <div className="bg-white border border-gray-200 rounded-2xl p-4 mt-4">
        <div className="flex flex-row justify-between items-center my-4">
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
        {/* {selectedPlan.outlineType === "timesPerWeek" && (
          <WeeklySessionsChecklist
            plan={selectedPlan}
            activityEntries={activityEntries}
          />
        )} */}

        {/* {selectedPlan.outlineType === "specific" &&
          areAllWeeklyActivitiesCompleted() && <WeeklyCompletionCard />} */}
        {/* 
        {selectedPlan.outlineType === "specific" && (
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
                    (a) => a.id === session.activityId
                  );
                  const completed = isSessionCompleted(
                    session,
                    selectedPlan,
                    activityEntries
                  );
                  const completedOn = getCompletedOn(
                    session,
                    selectedPlan,
                    activityEntries
                  );
                  if (!activity) return null;

                  return (
                    <SmallActivityEntryCard
                      key={`${session.date}-${session.activityId}`}
                      entry={session as Entry}
                      activity={activity}
                      completed={completed}
                      completedOn={completedOn}
                    />
                  );
                })}
            </div>
          </>
        )} */}
        <div className="mt-4">
          {selectedPlan.outlineType === "SPECIFIC" && (
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
              plan={selectedPlan}
              activities={activities.filter((a) =>
                selectedPlan.activities.map((a) => a.id).includes(a.id)
              )}
              startDate={getStartDate()}
            />
          ) : (
            <PlanActivityEntriesRenderer
              plan={selectedPlan}
              activities={activities}
              activityEntries={activityEntries}
              startDate={getStartDate()}
            />
          )}
        </div>
      </div>

      {/* {loading ? (
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
                      member.username !== currentUser?.username && member.username
                  )
                  .map((member, index) => ({
                    dataKey: member.username,
                    name: `${member.name}'s Sessions`,
                    color: `hsl(var(--chart-${index + 2}))`,
                  })),
                ...(currentUser?.username
                  ? [
                      {
                        dataKey: currentUser.username,
                        name: "Your Sessions",
                        color: `hsl(var(--chart-${
                          planGroupMembers.filter(
                            (member) => member.username !== currentUser?.username
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
      )} */}

      {selectedPlan.planGroup?.members &&
        selectedPlan.planGroup.members.length >= 2 && (
          <div className="bg-white border border-gray-200 rounded-lg p-4 mt-4">
            <h2 className="text-lg font-semibold mb-2">People in this plan</h2>
            <div className="flex flex-row flex-wrap gap-6">
              {selectedPlan.planGroup.members.map((member) => (
                <div
                  key={member.id}
                  className="flex flex-row flex-nowrap gap-2 items-center"
                >
                  <Link href={`/profile/${member.username}`}>
                    <Avatar className="w-12 h-12 text-2xl">
                      <AvatarImage
                        src={member.picture || ""}
                        alt={member.name || member.username || ""}
                      />
                      <AvatarFallback>{member.name?.[0] || "U"}</AvatarFallback>
                    </Avatar>
                  </Link>
                  <div className="text-lg text-gray-800">
                    {currentUser?.username === member.username
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
        onSuccess={() => {
          setShowEditModal(false);
          setOpenedFromMilestone(false);
        }}
        scrollToMilestones={openedFromMilestone}
      />
    </div>
  );
}
