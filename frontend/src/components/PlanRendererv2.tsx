import { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
  isSameWeek,
  formatDistance,
} from "date-fns";
import {
  ApiPlan,
  useUserPlan,
  UserDataEntry,
  convertApiPlanToPlan,
} from "@/contexts/UserPlanContext";
import { BarChart } from "@/components/charts/bar";
import {
  ArrowBigRight,
  BadgeCheck,
  BadgeCheckIcon,
  Check,
  Loader2,
  PlusSquare,
  X,
} from "lucide-react";
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
import {
  getCompletedOn,
  isSessionCompleted,
} from "@/contexts/PlanProgressContext/lib";
import { usePlanProgress } from "@/contexts/PlanProgressContext";
import { PlanWeekDisplay } from "./PlanWeekDisplay";
import { cn } from "@/lib/utils";
import { getThemeVariants } from "@/utils/theme";
import { useThemeColors } from "@/hooks/useThemeColors";
import { MessageBubble } from "./MessageBubble";
import { toast } from "react-hot-toast";

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
  const [showAllWeeks, setShowAllWeeks] = useState(false);
  const [selectedSuggestedSession, setSelectedSuggestedSession] = useState<
    string | null
  >(null);
  const [loadingStates, setLoadingStates] = useState({
    acceptingSessions: false,
    decliningSessions: false,
    acceptingTimesPerWeek: false,
    decliningTimesPerWeek: false,
  });

  const { plansProgress } = usePlanProgress();
  const planProgress = plansProgress.find((p) => p.plan.id === selectedPlan.id);
  const currentWeekRef = useRef<HTMLDivElement>(null);
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);
  const planActivities = userData?.activities.filter((a) =>
    selectedPlan.activity_ids?.includes(a.id)
  );

  // Reusable functions for handling coach suggestions
  const handleAcceptSuggestion = async (
    suggestionType: "sessions" | "times_per_week"
  ) => {
    const loadingKey =
      suggestionType === "sessions"
        ? "acceptingSessions"
        : "acceptingTimesPerWeek";

    try {
      setLoadingStates((prev) => ({ ...prev, [loadingKey]: true }));

      let updateData: any = {
        suggested_by_coach_at: null,
        coach_notes: null,
      };

      if (suggestionType === "sessions") {
        updateData = {
          ...updateData,
          sessions: selectedPlan.coach_suggested_sessions,
          coach_suggested_sessions: null,
        };
      } else if (suggestionType === "times_per_week") {
        updateData = {
          ...updateData,
          times_per_week: selectedPlan.coach_suggested_times_per_week,
          coach_suggested_times_per_week: null,
        };
      }

      await api.post(`/plans/${selectedPlan.id}/update`, {
        data: updateData,
      });
      currentUserDataQuery.refetch();
      toast.success(
        suggestionType === "sessions"
          ? "Schedule updated successfully!"
          : "Plan updated successfully!"
      );
    } catch (error) {
      console.error("Failed to accept suggestion:", error);
      toast.error(
        suggestionType === "sessions"
          ? "Failed to update schedule"
          : "Failed to update plan"
      );
    } finally {
      setLoadingStates((prev) => ({ ...prev, [loadingKey]: false }));
    }
  };

  const handleDeclineSuggestion = async (
    suggestionType: "sessions" | "times_per_week"
  ) => {
    const loadingKey =
      suggestionType === "sessions"
        ? "decliningSessions"
        : "decliningTimesPerWeek";

    try {
      setLoadingStates((prev) => ({ ...prev, [loadingKey]: true }));

      let updateData: any = {
        suggested_by_coach_at: null,
        coach_notes: null,
      };

      if (suggestionType === "sessions") {
        updateData.coach_suggested_sessions = null;
      } else if (suggestionType === "times_per_week") {
        updateData.coach_suggested_times_per_week = null;
      }

      await api.post(`/plans/${selectedPlan.id}/update`, {
        data: updateData,
      });
      currentUserDataQuery.refetch();
      toast.success("Suggestion declined");
    } catch (error) {
      console.error("Failed to decline suggestion:", error);
      toast.error("Failed to decline suggestion");
    } finally {
      setLoadingStates((prev) => ({ ...prev, [loadingKey]: false }));
    }
  };

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

  const getMemberData = (username: string): UserDataEntry | undefined => {
    if (username === userData?.user?.username) return userData;
    return membersData?.[username];
  };

  const activities = useMemo(() => {
    return userData?.activities || [];
  }, [userData]);

  const activityEntries = useMemo(() => {
    return userData?.activityEntries || [];
  }, [userData]);

  const { planGroupMembers, memberPlans } = useMemo(() => {
    if (!selectedPlan.plan_group_id)
      return { planGroupMembers: [], memberPlans: new Map() };

    const group = userData?.planGroups.find(
      (group) => group.id === selectedPlan.plan_group_id
    );

    group?.members?.forEach((member) => {
      if (member.username !== userData?.user?.username) {
        fetchUserData({ username: member.username });
      }
    });

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

      if (startDate && endDate) {
        completedEntries = completedEntries.filter((entry) => {
          const entryDate = parseISO(entry.date);
          return entryDate >= startDate && entryDate <= endDate;
        });
      }

      const entriesByDate = completedEntries.reduce((acc, entry) => {
        const dateKey = format(parseISO(entry.date), "yyyy-MM-dd");
        if (!acc[dateKey]) {
          acc[dateKey] = entry;
        }
        return acc;
      }, {} as { [key: string]: (typeof completedEntries)[0] });

      return Object.values(entriesByDate);
    },
    [userData, planGroupMembers, membersData]
  );

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

  useEffect(() => {
    const calculateSessionData = () => {
      setLoading(true);
      if (!selectedPlan || !selectedPlan.plan_group_id) {
        setLoading(false);
        return;
      }

      const groupPlans = planGroupMembers
        .map((member) => {
          const memberData = getMemberData(member.username);
          return memberData?.plans.find(
            (p) => p.plan_group_id === selectedPlan.plan_group_id
          );
        })
        .filter((p): p is ApiPlan => p !== undefined);

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

      const startDate =
        timeRange === "recent"
          ? subDays(new Date(), 30)
          : subWeeks(startOfWeek(allDates[0]), 1);
      const endDate = addWeeks(endOfWeek(allDates[allDates.length - 1]), 1);
      const weeklyData: {
        [key: string]: { [username: string]: number; planned: number };
      } = {};

      let currentWeekStart = startOfWeek(startDate);
      while (currentWeekStart <= endDate) {
        const weekKey = format(currentWeekStart, "yyyy-MM-dd");
        const weekEnd = endOfWeek(currentWeekStart);

        if (timeRange === "recent" && isBefore(weekEnd, startDate)) {
          currentWeekStart = addWeeks(currentWeekStart, 1);
          continue;
        }

        weeklyData[weekKey] = { planned: 0 };

        if (selectedPlan.outline_type === "times_per_week") {
          weeklyData[weekKey].planned = selectedPlan.times_per_week || 0;
        } else {
          const plannedThisWeek = selectedPlan.sessions.filter((session) => {
            const sessionDate = parseISO(session.date);
            return sessionDate >= currentWeekStart && sessionDate <= weekEnd;
          }).length;
          weeklyData[weekKey].planned += plannedThisWeek;
        }

        groupPlans.forEach((plan) => {
          const member = planGroupMembers.find(
            (m) => m.user_id === plan.user_id
          );
          if (!member) return;

          const completedThisWeek = getCompletedSessionsForPlan(
            plan,
            currentWeekStart,
            weekEnd
          ).length;
          weeklyData[weekKey][member.username] = completedThisWeek;
        });

        currentWeekStart = addWeeks(currentWeekStart, 1);
      }

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

  // const areAllWeeklyActivitiesCompleted = useCallback(() => {
  //   const currentWeekStart = startOfWeek(new Date());
  //   const currentWeekEnd = endOfWeek(new Date());

  //   const thisWeekSessions = selectedPlan.sessions.filter((session) => {
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

      <div className="flex flex-col gap-2 mt-2 bg-gray-50 ring-2 ring-gray-200 rounded-lg p-2">
        <div className="flex flex-row items-center justify-between my-4">
          <div className="flex flex-row items-center justify-start gap-2">
            <span className="text-4xl">🗓️</span>
            <h2 className="text-xl font-semibold mt-2">Weeks Overview</h2>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAllWeeks(!showAllWeeks)}
            className="text-sm"
          >
            {showAllWeeks ? "Show Current + Next" : "Show All Weeks"}
          </Button>
        </div>
        {selectedPlan.suggested_by_coach_at && (
          <div className="flex flex-row items-center justify-center gap-2 my-4">
            <BadgeCheck className="h-5 w-5 text-green-500" />
            <span className="text-sm text-gray-500 text-center">
              Last updated by coach{" "}
              <span className="font-semibold">
                {formatDistance(
                  new Date(),
                  parseISO(selectedPlan.suggested_by_coach_at)
                )}{" "}
                ago
              </span>
            </span>
          </div>
        )}
        {selectedPlan.coach_notes && (
          <MessageBubble direction="left">
            <div className="flex flex-col items-start gap-2">
              <Avatar>
                <AvatarImage src="https://alramalhosandbox.s3.eu-west-1.amazonaws.com/tracking_software/jarvis_logo.png" />
                <AvatarFallback>CN</AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-1 flex-1">
                <span className={`text-sm italic text-gray-500`}>
                  {selectedPlan.coach_notes}
                </span>
                <span className="text-[10px] italic text-gray-400">
                  Coach Eli
                </span>
              </div>
            </div>
          </MessageBubble>
        )}
        {selectedPlan.coach_suggested_sessions &&
          selectedPlan.coach_suggested_sessions.length > 0 && (
            <div className="flex flex-col justify-start gap-4 p-4 bg-white rounded-xl border border-gray-100">
              <div className="flex flex-col gap-3">
                <div className="text-center">
                  <span className="text-lg font-semibold text-gray-800 mb-2 block">
                    New Schedule Suggestion
                  </span>
                  <span className="text-xs text-gray-400 font-medium">
                    UPDATED SESSIONS
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-64 overflow-y-auto">
                  {selectedPlan.coach_suggested_sessions.map(
                    (session, index) => {
                      const activity = planActivities?.find(
                        (a) => a.id === session.activity_id
                      );
                      if (!activity) return null;

                      const sessionId = `coach-session-${session.activity_id}-${index}`;
                      const isSelected = selectedSuggestedSession === sessionId;

                      return (
                        <SmallActivityEntryCard
                          key={sessionId}
                          entry={{
                            date: parseISO(session.date),
                            activity_id: session.activity_id,
                            quantity: session.quantity,
                            description: session.descriptive_guide,
                          }}
                          activity={activity}
                          selected={isSelected}
                          onClick={(clickedSessionId) => {
                            setSelectedSuggestedSession(
                              clickedSessionId === selectedSuggestedSession
                                ? null
                                : clickedSessionId
                            );
                          }}
                          className="bg-blue-50 border-2 border-blue-200 hover:bg-blue-100"
                        />
                      );
                    }
                  )}
                </div>
              </div>

              <div className="flex flex-row gap-3 justify-center mt-2">
                <Button
                  variant="outline"
                  className="flex-1 h-10 text-sm font-medium border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                  disabled={
                    loadingStates.decliningSessions ||
                    loadingStates.acceptingSessions
                  }
                  onClick={async () => {
                    await handleDeclineSuggestion("sessions");
                  }}
                >
                  {loadingStates.decliningSessions ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <X className="h-4 w-4 mr-2" />
                  )}
                  Decline
                </Button>
                <Button
                  className="flex-1 h-10 text-sm font-medium bg-green-600 hover:bg-green-700"
                  disabled={
                    loadingStates.acceptingSessions ||
                    loadingStates.decliningSessions
                  }
                  onClick={async () => {
                    await handleAcceptSuggestion("sessions");
                  }}
                >
                  {loadingStates.acceptingSessions ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Accept
                </Button>
              </div>
            </div>
          )}
        {selectedPlan.coach_suggested_times_per_week && (
          <div className="flex flex-col justify-start gap-4 p-4 bg-white rounded-xl border border-gray-100">
            <div className="flex flex-row justify-center items-center gap-4 md:gap-8">
              <div className="flex flex-col items-center text-center flex-shrink-0">
                <span className="text-4xl md:text-5xl font-light text-gray-800">
                  {selectedPlan.times_per_week}
                </span>
                <span className="text-xs text-gray-400 font-medium mt-1">
                  CURRENT
                </span>
              </div>

              <div className="flex items-center flex-shrink-0">
                <div className="w-8 md:w-16 h-px bg-gray-300"></div>
                <ArrowBigRight className="h-5 w-5 md:h-6 md:w-6 text-gray-400 mx-2" />
                <div className="w-8 md:w-16 h-px bg-gray-300"></div>
              </div>

              <div className="flex flex-col items-center text-center flex-shrink-0">
                <span className="text-4xl md:text-5xl font-light text-green-600">
                  {selectedPlan.coach_suggested_times_per_week}
                </span>
                <span className="text-xs text-gray-400 font-medium mt-1">
                  SUGGESTED
                </span>
              </div>
            </div>

            <div className="flex flex-row gap-3 justify-center mt-2">
              <Button
                variant="outline"
                className="flex-1 h-10 text-sm font-medium border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                disabled={
                  loadingStates.decliningTimesPerWeek ||
                  loadingStates.acceptingTimesPerWeek
                }
                onClick={async () => {
                  await handleDeclineSuggestion("times_per_week");
                }}
              >
                {loadingStates.decliningTimesPerWeek ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <X className="h-4 w-4 mr-2" />
                )}
                Decline
              </Button>
              <Button
                className="flex-1 h-10 text-sm font-medium bg-green-600 hover:bg-green-700"
                disabled={
                  loadingStates.acceptingTimesPerWeek ||
                  loadingStates.decliningTimesPerWeek
                }
                onClick={async () => {
                  await handleAcceptSuggestion("times_per_week");
                }}
              >
                {loadingStates.acceptingTimesPerWeek ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Accept
              </Button>
            </div>
          </div>
        )}
        {weeksToDisplay.map((week, index) => {
          const isCurrentWeek = isSameWeek(week.startDate, new Date(), {
            weekStartsOn: 0,
          });
          const actualWeekIndex =
            planProgress?.weeks.findIndex(
              (w) => w.startDate.getTime() === week.startDate.getTime()
            ) ?? index;
          return (
            <div
              key={actualWeekIndex}
              ref={isCurrentWeek ? currentWeekRef : null}
              className="flex flex-col gap-2 p-3 rounded-lg bg-white p-2"
            >
              <PlanWeekDisplay
                title={
                  <div className="flex justify-between items-center w-full">
                    <span className="text-lg font-semibold">
                      Week {actualWeekIndex + 1} {isCurrentWeek && "(Current)"}
                    </span>
                    <span className="text-sm text-gray-500">
                      {format(week.startDate, "d")}-
                      {format(endOfWeek(week.startDate), "d MMM")}
                    </span>
                  </div>
                }
                plan={convertApiPlanToPlan(selectedPlan, activities)}
                date={week.startDate}
              />
            </div>
          );
        })}
      </div>

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

      <div className="bg-white border border-gray-200 rounded-lg p-4 mt-4">
        <div className="flex flex-row items-center justify-start gap-2 mb-2">
          <span className="text-4xl">🎯</span>
          <h2 className="text-xl font-semibold mt-2">
            Full Activities Overview
          </h2>
        </div>

        {/* {selectedPlan.outline_type === "times_per_week" && (
          <WeeklySessionsChecklist
            plan={selectedPlan}
            activityEntries={activityEntries}
          />
        )} */}

        {/* {selectedPlan.outline_type === "specific" &&
          areAllWeeklyActivitiesCompleted() && <WeeklyCompletionCard />} */}
        {/* 
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
        )} */}
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
