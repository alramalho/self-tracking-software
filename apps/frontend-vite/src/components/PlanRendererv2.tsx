import { useActivities } from "@/contexts/activities/useActivities";
import { type CompletePlan, usePlans } from "@/contexts/plans";
import { useCurrentUser } from "@/contexts/users";
import { useThemeColors } from "@/hooks/useThemeColors";
import { getThemeVariants } from "@/utils/theme";
import { getPeriodLabel } from "@/utils/coachingTime";
import { Link } from "@tanstack/react-router";
import { addWeeks, endOfWeek, format, isFuture, isSameWeek, startOfWeek, subDays } from "date-fns";
import { BadgeCheck, ChartArea, Loader2, Maximize2, Minimize2, Pencil, PlusSquare, Send, Trash2, UserPlus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import AppleLikePopover from "./AppleLikePopover";
import { CoachingTimeSelector } from "./CoachingTimeSelector";
import ConfirmDialogOrPopover from "./ConfirmDialogOrPopover";
import { CoachOverviewCard } from "./CoachOverviewCard";
import InviteButton from "./InviteButton";
import { MilestoneOverview } from "./MilestoneOverview";
import PlanActivityEntriesRenderer from "./PlanActivityEntriesRenderer";
import { PlanEditModal } from "./PlanEditModal";
import PlanSessionsRenderer from "./PlanSessionsRenderer";
import { PlanWeekDisplay } from "./PlanWeekDisplay";
import { PlanGroupProgressChart } from "./PlanGroupProgressChart";
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
  const { currentUser, updateUser } = useCurrentUser();
  const { plans, leavePlanGroup, isLeavingPlanGroup, deletePlan } = usePlans();
  const { activities, activityEntries } = useActivities();

  const [showEditModal, setShowEditModal] = useState(false);
  const [openedFromMilestone, setOpenedFromMilestone] = useState(false);
  const [timeRange, setTimeRange] = useState<"recent" | "all">("recent");
  const [displayFutureActivities, setDisplayFutureActivities] = useState(false);
  const [showAllWeeks, setShowAllWeeks] = useState(false);
  const [showLeaveGroupPopover, setShowLeaveGroupPopover] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCoachingTimeSelector, setShowCoachingTimeSelector] = useState(false);

  const planProgress = selectedPlan.progress;
  const currentWeekRef = useRef<HTMLDivElement>(null);
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);

  const isPlanCoached = useCallback((selectedPlan: CompletePlan) => {
    if (!plans) return false;
    // Check if the plan has the isCoached flag
    return (selectedPlan as any).isCoached || false;
  }, [selectedPlan, plans]);

  // Auto-scroll to current week when weeks data loads
  useEffect(() => {
    if (currentWeekRef.current && planProgress?.weeks?.length) {
      // Small delay to ensure the layout is complete
      setTimeout(() => {
        currentWeekRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 100);
    }
  }, [planProgress?.weeks?.length]);

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
      return planProgress.weeks.filter(w => isFuture(startOfWeek(w.startDate)) || isSameWeek(startOfWeek(w.startDate), new Date(), { weekStartsOn: 0 }));
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

  const handleDeletePlan = async () => {
    await deletePlan(selectedPlan.id!);
    setShowDeleteConfirm(false);
  };

  const handleSaveCoachingTime = async (startHour: number) => {
    if (!currentUser) return;

    try {
      await updateUser({ updates: { preferredCoachingHour: startHour }, muteNotifications: true });
      toast.success("Coaching time updated");
    } catch (error) {
      console.error("Failed to update coaching time:", error);
      toast.error("Failed to update coaching time");
      throw error;
    }
  };

  const preferredCoachingHour = currentUser?.preferredCoachingHour ?? 6;
  const periodLabel = getPeriodLabel(preferredCoachingHour);

  return (
    <div>
      <div className="flex flex-row items-start justify-start gap-2 mb-8">
        <span className="text-5xl">{selectedPlan.emoji}</span>
        <div className="flex flex-col gap-2 justify-start">
          <h2 className="text-2xl font-semibold">{selectedPlan.goal}</h2>
          <span className="text-sm text-muted-foreground">
            {selectedPlan.outlineType === "TIMES_PER_WEEK"
              ? `${selectedPlan.timesPerWeek} times per week`
              : `custom plan`}
          </span>
          <div className="flex gap-2 items-center justify-start">
            {isPlanCoached(selectedPlan) && (
              <div className="flex items-center gap-1 mr-2">
                <BadgeCheck className={`h-5 w-5 ${variants.text}`} />
                <span className="text-sm text-muted-foreground">Coached</span>
              </div>
            )}
            <InviteButton
              planId={selectedPlan.id!}
              onInviteSuccess={() => {}}
              isExternalSupported={false}
              planEmoji={selectedPlan.emoji || undefined}
              planGoal={selectedPlan.goal}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowEditModal(true)}
              className="text-muted-foreground hover:text-foreground"
            >
              <Pencil className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowDeleteConfirm(true)}
              className="text-red-400 hover:text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-5 w-5" />
            </Button>
          </div>
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

      {selectedPlan.planGroupId && (
        <div className="mb-8">
          <PlanGroupProgressChart planId={selectedPlan.id} />
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
          <>
            <CoachOverviewCard
              selectedPlan={selectedPlan}
              activities={activities}
            />

            {/* Coaching Time Selector Section */}
            <div
              className={`flex items-center justify-center gap-3 p-4 rounded-2xl bg-muted cursor-pointer hover:bg-accent/50 transition-colors`}
              onClick={() => setShowCoachingTimeSelector(true)}
            >
              <Send className={`h-5 w-5 text-muted-foreground`} />
              <span className="text-sm font-medium text-foreground">
                Sends message every{" "}
                <span className={`underline`}>
                  {periodLabel}
                </span>
              </span>
            </div>
          </>
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
          const totalWeeks = planProgress?.weeks?.length ?? 0;
          console.log({weeks: planProgress?.weeks})
          const actualWeekIndex =
            planProgress?.weeks?.findIndex(
              (w) => {
                console.log({startDate: w?.startDate});
                return w?.startDate.getTime() === week?.startDate.getTime();
              }
            ) ?? index;
          return (
            <div
              key={actualWeekIndex}
              ref={isCurrentWeek ? currentWeekRef : null}
              className="flex flex-col gap-2 p-3 rounded-2xl bg-card p-2 border border-border"
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
                    <span className="text-sm text-muted-foreground">
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
      <div className="bg-card border border-border rounded-2xl p-4 mt-4">
        <div className="flex flex-row justify-between items-center my-4">
          <span className="text-sm text-muted-foreground">Time range</span>
          <Select
            value={timeRange}
            onValueChange={(value: "recent" | "all") => setTimeRange(value)}
          >
            <div className="bg-card font-semibold text-foreground">
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
              <h2 className="text-lg font-semibold text-gfrom './EmblaCarouselSelecteay-800">This week</h2>

              <span className="text-sm text-muted-foreground ">
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
              <span className="text-xs text-muted-foreground">Completed</span>
              <Switch
                data-testid="display-future-activities-switch"
                checked={displayFutureActivities}
                onCheckedChange={setDisplayFutureActivities}
              />
              <span className="text-xs text-muted-foreground">Planned</span>
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
          <div className="bg-card border border-border rounded-lg p-4 mt-4">
            <div className="flex flex-row items-center justify-between mb-2">
              <h2 className="text-lg font-semibold">People in this plan</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowLeaveGroupPopover(true)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                Leave Group
              </Button>
            </div>
            <div className="flex flex-row flex-wrap gap-6">
              {selectedPlan.planGroup.members.map((member) => {
                const user = (member as any).user || member;
                return (
                  <div
                    key={member.id}
                    className="flex flex-row flex-nowrap gap-2 items-center"
                  >
                    <Link to="/profile/$username" params={{ username: user.username || "" }}>
                      <Avatar className="w-12 h-12 text-2xl">
                        <AvatarImage
                          src={user.picture || ""}
                          alt={user.name || user.username || ""}
                        />
                        <AvatarFallback>{user.name?.[0] || "U"}</AvatarFallback>
                      </Avatar>
                    </Link>
                    <div className="text-lg text-foreground">
                      {currentUser?.username === user.username
                        ? "You"
                        : user.name}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      <Link to="/add">
        <Button
          variant="outline"
          className="bg-muted/50 mt-4 w-full h-[100px] flex flex-col items-center justify-center border-2 border-dashed border-border text-muted-foreground"
        >
          <PlusSquare className="h-8 w-8 mb-2 text-muted-foreground/70" />
          <span>Log Activity</span>
        </Button>
      </Link>

      <AppleLikePopover
        open={showLeaveGroupPopover}
        onClose={() => setShowLeaveGroupPopover(false)}
        title="Leave Plan Group"
      >
        <div className="flex flex-col gap-4 p-4">
          <h2 className="text-xl font-semibold text-center">Leave Plan Group?</h2>
          <p className="text-sm text-muted-foreground text-center">
            You'll leave this group but your plan and activities will remain intact.
            You can continue working on your plan independently.
          </p>
          <div className="flex flex-col gap-2 mt-4">
            <Button
              variant="destructive"
              onClick={async () => {
                await leavePlanGroup(selectedPlan.id);
                setShowLeaveGroupPopover(false);
              }}
              disabled={isLeavingPlanGroup}
              className="w-full"
            >
              {isLeavingPlanGroup ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Leaving...
                </>
              ) : (
                "Leave Group"
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowLeaveGroupPopover(false)}
              disabled={isLeavingPlanGroup}
              className="w-full"
            >
              Cancel
            </Button>
          </div>
        </div>
      </AppleLikePopover>

      <ConfirmDialogOrPopover
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeletePlan}
        title={
          <div className="flex items-center justify-center gap-2">
            <Trash2 className="h-6 w-6 text-red-400" /> Delete Plan
          </div>
        }
        description="Are you sure you want to delete this plan? This action cannot be undone."
        confirmText="Delete Plan"
        cancelText="Cancel"
        variant="destructive"
      />

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

      {/* Coaching Time Selector Popover */}
      {isPlanCoached(selectedPlan) && (
        <CoachingTimeSelector
          open={showCoachingTimeSelector}
          onClose={() => setShowCoachingTimeSelector(false)}
          onSave={handleSaveCoachingTime}
          currentStartHour={preferredCoachingHour}
        />
      )}
    </div>
  );
}