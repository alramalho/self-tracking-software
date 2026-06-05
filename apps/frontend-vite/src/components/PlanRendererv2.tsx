import { useApiWithAuth } from "@/api";
import { useActivities } from "@/contexts/activities/useActivities";
import { type CompletePlan, usePlans } from "@/contexts/plans";
import { useCurrentUser } from "@/contexts/users";
import { useMetrics } from "@/contexts/metrics";
import { getPeriodLabel } from "@/utils/coachingTime";
import { MINIMUM_ENTRIES } from "@/lib/metrics";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  addWeeks,
  endOfWeek,
  format,
  isFuture,
  isSameWeek,
  startOfWeek,
  subDays,
} from "date-fns";
import {
  Archive,
  Loader2,
  Maximize2,
  MessageCircle,
  Minimize2,
  Pause,
  Pencil,
  Play,
  PlusSquare,
  Send,
  Trash2,
  UserPlus,
  BarChart3,
  BarChartHorizontal,
  Activity,
  ChevronDown,
  FileText,
  Flame,
  Rocket,
  Sprout,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { toast } from "react-hot-toast";
import AppleLikePopover from "./AppleLikePopover";
import { CoachingTimeSelector } from "./CoachingTimeSelector";
import ConfirmDialogOrPopover from "./ConfirmDialogOrPopover";
import InviteButton from "./InviteButton";
import { MilestoneOverview } from "./MilestoneOverview";
import { PlanCoachActionPreview } from "./PlanCoachActionPreview";
import PlanActivityEntriesRenderer from "./PlanActivityEntriesRenderer";
import PlanSessionsRenderer from "./PlanSessionsRenderer";
import { PlanWeekDisplay } from "./PlanWeekDisplay";
import { PlanCalendarView } from "./PlanCalendarView";
import { PlanGroupProgressChart } from "./PlanGroupProgressChart";
import { MetricInsightsCard } from "./metrics/MetricInsightsCard";
import { CorrelationHelpPopover } from "./metrics/CorrelationHelpPopover";
import { FireAnimation } from "./FireBadge";
import { SteppedBarProgress } from "./SteppedBarProgress";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";
import { cn } from "@/lib/utils";
import { PlanNotesBlock } from "./PlanNotesBlock";

interface PlanRendererv2Props {
  selectedPlan: CompletePlan;
  scrollTo?: string;
}

// Animated section component that fades in when scrolled into view
const AnimatedSection = ({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
};

interface HumanCoach {
  id: string;
  ownerId: string;
  type: "HUMAN";
  details: {
    title: string;
    bio?: string;
    focusDescription: string;
    idealPlans?: Array<{ emoji: string; title: string }>;
  };
  owner: {
    id: string;
    username: string;
    name: string | null;
    picture: string | null;
  };
}

const PlanProgressStrip = ({ plan }: { plan: CompletePlan }) => {
  const currentWeek = plan.progress?.weeks?.find((week: any) =>
    isSameWeek(new Date(week.startDate), new Date())
  );

  if (!currentWeek || !plan.progress?.achievement) return null;

  const totalPlanned =
    plan.outlineType === "TIMES_PER_WEEK"
      ? (currentWeek.plannedActivities as number) || 0
      : ((currentWeek.plannedActivities as any[])?.length || 0);

  const uniqueDays = new Set(
    (currentWeek.completedActivities || []).map((entry: any) =>
      format(new Date(entry.datetime || entry.date), "yyyy-MM-dd")
    )
  );
  const totalCompleted = uniqueDays.size;
  const streak = plan.progress.achievement.streak ?? 0;

  const habitProgress =
    plan.progress.habitAchievement?.progressValue ?? Math.min(4, streak);
  const habitMax = plan.progress.habitAchievement?.maxValue ?? 4;
  const habitAchieved =
    plan.progress.habitAchievement?.isAchieved || streak >= 4;
  const lifestyleProgress =
    plan.progress.lifestyleAchievement?.progressValue ?? Math.min(9, streak);
  const lifestyleMax = plan.progress.lifestyleAchievement?.maxValue ?? 9;

  return (
    <div className="px-4 py-2 space-y-3">
      <SteppedBarProgress
        value={totalCompleted}
        maxValue={totalPlanned}
        goal={<Flame size={19} className="text-orange-400" />}
        className="w-full"
        emptyColor="bg-muted/60"
      />
      {!habitAchieved ? (
        <SteppedBarProgress
          value={habitProgress}
          maxValue={habitMax}
          goal={<Sprout size={19} className="text-lime-500" />}
          className="w-full"
          color="bg-lime-400"
          emptyColor="bg-muted/60"
        />
      ) : (
        <SteppedBarProgress
          value={lifestyleProgress}
          maxValue={lifestyleMax}
          goal={<Rocket size={19} className="text-amber-400" />}
          className="w-full"
          color="bg-amber-400"
          emptyColor="bg-muted/60"
        />
      )}
    </div>
  );
};

const PlanNotesSection = ({ notes }: { notes?: string | null }) => {
  const [isOpen, setIsOpen] = useState(false);
  const trimmedNotes = notes?.trim();

  if (!trimmedNotes) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="rounded-2xl border border-border bg-card p-4">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 text-left"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted/60">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-foreground">
                  Plan notes
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  Roadmap, sources, constraints, and coach context
                </div>
              </div>
            </div>
            <ChevronDown
              className={cn(
                "h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200",
                isOpen && "rotate-180"
              )}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <PlanNotesBlock
            notes={trimmedNotes}
            className="mt-4 border-t border-border pt-4 text-sm leading-relaxed text-muted-foreground"
          />
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

export function PlanRendererv2({ selectedPlan, scrollTo }: PlanRendererv2Props) {
  const { currentUser, updateUser } = useCurrentUser();
  const { leavePlanGroup, isLeavingPlanGroup, deletePlan, pausePlan, isPausingPlan, resumePlan, isResumingPlan, archivePlan } = usePlans();
  const { activities, activityEntries } = useActivities();
  const { metrics, entries: metricEntries } = useMetrics();
  const api = useApiWithAuth();
  const navigate = useNavigate();

  // Fetch human coaches to get coach info for the plan
  const { data: humanCoaches } = useQuery({
    queryKey: ["coaches"],
    queryFn: async () => {
      const response = await api.get<HumanCoach[]>("/coaches");
      return response.data;
    },
    enabled: !!(selectedPlan as any).coachId,
  });

  // Find the coach for this plan
  const planCoach = useMemo(() => {
    if (!humanCoaches || !(selectedPlan as any).coachId) return null;
    return humanCoaches.find((c) => c.id === (selectedPlan as any).coachId) || null;
  }, [humanCoaches, (selectedPlan as any).coachId]);

  const [displayFutureActivities, setDisplayFutureActivities] = useState(false);
  const [showAllWeeks, setShowAllWeeks] = useState(false);
  const [showAllWeeksPopover, setShowAllWeeksPopover] = useState(false);
  const [showLeaveGroupPopover, setShowLeaveGroupPopover] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showPausePopover, setShowPausePopover] = useState(false);
  const [pauseReason, setPauseReason] = useState("");
  const [showCoachingTimeSelector, setShowCoachingTimeSelector] =
    useState(false);
  const [helpMetricId, setHelpMetricId] = useState<string | null>(null);

  const planProgress = selectedPlan.progress;
  const currentWeekRef = useRef<HTMLDivElement>(null);
  // Conditional scroll to current week based on URL parameter
  useEffect(() => {
    if (scrollTo === "current-week" && currentWeekRef.current && planProgress?.weeks?.length) {
      // Small delay to ensure the layout is complete
      setTimeout(() => {
        currentWeekRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 100);
    }
  }, [scrollTo, planProgress?.weeks?.length]);

  // Always show all-time data - no start date filtering
  const getStartDate = useCallback(() => {
    return undefined;
  }, []);

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

  // Filter weeks to show only current week, or all weeks for popover
  const currentWeekData = useMemo(() => {
    if (!planProgress?.weeks) return null;

    const currentWeekIndex = planProgress.weeks.findIndex((week) =>
      isSameWeek(week.startDate, new Date(), { weekStartsOn: 0 })
    );

    if (currentWeekIndex === -1) {
      // If no current week found, show first week
      return planProgress.weeks[0] || null;
    }

    return planProgress.weeks[currentWeekIndex];
  }, [planProgress?.weeks]);

  const allWeeksData = useMemo(() => {
    if (!planProgress?.weeks) return [];
    return planProgress.weeks.filter(
      (w) =>
        isFuture(startOfWeek(w.startDate)) ||
        isSameWeek(startOfWeek(w.startDate), new Date(), { weekStartsOn: 0 })
    );
  }, [planProgress?.weeks]);

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

  const handleArchivePlan = async () => {
    await archivePlan(selectedPlan.id!);
    setShowArchiveConfirm(false);
  };

  const handlePausePlan = async () => {
    await pausePlan(selectedPlan.id!, pauseReason || undefined);
    setShowPausePopover(false);
    setPauseReason("");
  };

  const handleResumePlan = async () => {
    await resumePlan(selectedPlan.id!);
  };

  const isPlanPaused = (selectedPlan as any).isPaused;

  const handleSaveCoachingTime = async (startHour: number) => {
    if (!currentUser) return;

    try {
      await updateUser({
        updates: { preferredCoachingHour: startHour },
        muteNotifications: true,
      });
      toast.success("Coaching time updated");
    } catch (error) {
      console.error("Failed to update coaching time:", error);
      toast.error("Failed to update coaching time");
      throw error;
    }
  };

  const preferredCoachingHour = currentUser?.preferredCoachingHour ?? 6;
  const periodLabel = getPeriodLabel(preferredCoachingHour);

  // Filter activities to only those in this plan
  const planActivities = useMemo(() => {
    const planActivityIds = selectedPlan.activities.map((a) => a.id);
    return activities.filter((activity) =>
      planActivityIds.includes(activity.id)
    );
  }, [selectedPlan.activities, activities]);

  // Filter metrics that have enough entries
  const metricsWithEnoughData = useMemo(() => {
    return (
      metrics?.filter((metric) => {
        const count =
          metricEntries?.filter((e) => e.metricId === metric.id).length || 0;
        return count >= MINIMUM_ENTRIES;
      }) || []
    );
  }, [metrics, metricEntries]);

  const backgroundImageUrl = (selectedPlan as any)?.backgroundImageUrl;
  const selectedPlanStreak = selectedPlan.progress?.achievement?.streak ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Background image section */}
      {backgroundImageUrl && (
        <AnimatedSection>
          <div className="relative h-48 w-full rounded-2xl overflow-hidden mb-6">
            <img
              src={backgroundImageUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/40 to-background" />
          </div>
        </AnimatedSection>
      )}

      <AnimatedSection delay={backgroundImageUrl ? 0.1 : 0}>
        <div className="flex flex-row items-start justify-start gap-3 mb-4">
          <span className="text-5xl leading-none">{selectedPlan.emoji}</span>
          <div className="flex min-w-0 flex-1 flex-col gap-3 justify-start">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="min-w-0 text-2xl font-semibold leading-tight">
                  {selectedPlan.goal}
                </h2>
                <span className="mt-1 block text-sm leading-tight text-muted-foreground">
                  {selectedPlan.outlineType === "TIMES_PER_WEEK"
                    ? `${selectedPlan.timesPerWeek} times per week`
                    : `custom plan`}
                  {selectedPlan.finishingDate && (
                    <> · until {format(selectedPlan.finishingDate, "MMM d, yyyy")}</>
                  )}
                </span>
              </div>
              <div
                className={`flex shrink-0 items-center gap-1 pt-1 ${
                  selectedPlanStreak === 0 ? "grayscale opacity-50" : ""
                }`}
              >
                <span className="text-lg font-cursive leading-none">
                  x{selectedPlanStreak}
                </span>
                <FireAnimation height={40} width={40} className="pb-2" />
              </div>
            </div>
            <div className="flex gap-2 items-center justify-start">
              {isPlanPaused && (
                <div className="flex items-center gap-1 mr-2 px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
                  <Pause className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                  <span className="text-sm text-yellow-600 dark:text-yellow-400 font-medium">Paused</span>
                </div>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowDeleteConfirm(true)}
                className="text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <Trash2 className="h-6 w-6" />
              </Button>
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
                onClick={() => navigate({ to: "/edit-plan/$planId", params: { planId: selectedPlan.id! } })}
                className="text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <Pencil className="h-6 w-6" />
              </Button>
              {isPlanPaused ? (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleResumePlan}
                  disabled={isResumingPlan}
                  className="text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  {isResumingPlan ? <Loader2 className="h-6 w-6 animate-spin" /> : <Play className="h-6 w-6" />}
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowPausePopover(true)}
                  className="text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  <Pause className="h-6 w-6" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowArchiveConfirm(true)}
                className="text-muted-foreground hover:text-foreground hover:bg-muted"
                title="Archive plan"
              >
                <Archive className="h-6 w-6" />
              </Button>
            </div>
          </div>
        </div>
      </AnimatedSection>

      <AnimatedSection delay={backgroundImageUrl ? 0.12 : 0.05}>
        <div className="mb-8">
          <PlanProgressStrip plan={selectedPlan} />
        </div>
      </AnimatedSection>

      <AnimatedSection delay={backgroundImageUrl ? 0.13 : 0.06}>
        <div className="mb-6">
          <PlanNotesSection notes={selectedPlan.notes} />
        </div>
      </AnimatedSection>

      {/* AI Coach Overview */}
      {!planCoach && (
        <AnimatedSection delay={backgroundImageUrl ? 0.15 : 0.1}>
          <div className="mb-6">
          <div
            className={`flex items-center justify-center gap-3 p-4 rounded-2xl bg-muted cursor-pointer hover:bg-accent/50 transition-colors mt-4`}
            onClick={() => setShowCoachingTimeSelector(true)}
          >
            <Send className={`h-5 w-5 text-muted-foreground`} />
            <span className="text-sm font-medium text-foreground">
              Coach checks in around{" "}
              <span className={`underline`}>{periodLabel}</span>{" "}
              when it matters
            </span>
          </div>
          </div>
        </AnimatedSection>
      )}

      {selectedPlan.milestones && selectedPlan.milestones.length > 0 && (
        <AnimatedSection delay={backgroundImageUrl ? 0.15 : 0.1}>
          <div className="mb-8">
            <MilestoneOverview
              milestones={selectedPlan.milestones}
              planId={selectedPlan.id}
              onEdit={() => {
                navigate({ to: "/edit-plan/$planId", params: { planId: selectedPlan.id! } });
              }}
            />
          </div>
        </AnimatedSection>
      )}

      {/* 1. Activities Overview Grid */}
      <AnimatedSection delay={backgroundImageUrl ? 0.2 : 0.15}>
        <div className="rounded-2xl border border-border p-2 mb-6">
        {selectedPlan.outlineType === "SPECIFIC" && (
          <div className="flex flex-row justify-end items-center gap-2 mb-4">
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
      </AnimatedSection>
{/* 
      {!planCoach && (
        <AnimatedSection delay={backgroundImageUrl ? 0.23 : 0.18}>
          <div className="mb-6">
            <PlanCoachActionPreview selectedPlan={selectedPlan} />
          </div>
        </AnimatedSection>
      )} */}

      {/* 2. Next 2 Weeks Calendar View (SPECIFIC plans) or Current Week (TIMES_PER_WEEK) */}
      {selectedPlan.outlineType === "SPECIFIC" ? (
        <AnimatedSection delay={backgroundImageUrl ? 0.25 : 0.2}>
          <div id="current-week" ref={currentWeekRef} className="rounded-2xl bg-card border border-border p-4 mb-6">
            <div className="flex justify-between items-center mb-4">
              <span className="text-lg font-semibold">Coming up</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllWeeksPopover(true)}
                className="text-xs"
              >
                See all weeks
              </Button>
            </div>
            <PlanCalendarView plan={selectedPlan} />
          </div>
        </AnimatedSection>
      ) : currentWeekData && (
        <AnimatedSection delay={backgroundImageUrl ? 0.25 : 0.2}>
          <div id="current-week" ref={currentWeekRef} className="rounded-2xl bg-card border border-border p-4 mb-6">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold">Current week</span>
                <span className="text-sm text-muted-foreground">
                  {format(currentWeekData.startDate, "d")}-
                  {format(endOfWeek(currentWeekData.startDate), "d MMM")}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllWeeksPopover(true)}
                className="text-xs"
              >
                See all weeks
              </Button>
            </div>
            <PlanWeekDisplay
              plan={selectedPlan}
              date={currentWeekData.startDate}
            />
          </div>
        </AnimatedSection>
      )}

      {/* 3. Coach Info Banner (Human Coach) */}
      {planCoach && (
        <AnimatedSection delay={backgroundImageUrl ? 0.3 : 0.25}>
          <div className="mb-6">
            <div className="rounded-2xl overflow-hidden relative">
              {/* Background with coach's profile image */}
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{
                  backgroundImage: `url(${planCoach.owner.picture || ""})`,
                }}
              />
              {/* Dark overlay */}
              <div className="absolute inset-0 bg-black/60" />

              {/* Content */}
              <div className="relative p-4 text-white">
                <div className="flex items-center gap-3 mb-3">
                  <Avatar className="w-12 h-12 border-2 border-white/20">
                    <AvatarImage src={planCoach.owner.picture || ""} />
                    <AvatarFallback className="bg-white/20 text-white">
                      {planCoach.owner.name?.[0] || "C"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">
                      {planCoach.owner.name || planCoach.owner.username}
                    </p>
                    <p className="text-xs text-white/70">
                      {planCoach.details.title}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => navigate({ to: `/messages/${planCoach.owner.username}` })}
                  className="flex items-center justify-center gap-2 w-full py-2.5 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-xl text-white text-sm font-medium transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  Message Coach
                </button>
              </div>
            </div>
          </div>
        </AnimatedSection>
      )}

      {/* 4. Plan Group Progress */}
      {selectedPlan.planGroupId && (
        <AnimatedSection delay={backgroundImageUrl ? 0.4 : 0.35}>
          <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">Group Progress</h3>
          <p className="text-sm text-muted-foreground mb-4">
            See how your plan group is progressing this week
          </p>
          <PlanGroupProgressChart planId={selectedPlan.id} />

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
                        <Link
                          to="/profile/$username"
                          params={{ username: user.username || "" }}
                        >
                          <Avatar className="w-12 h-12 text-2xl">
                            <AvatarImage
                              src={user.picture || ""}
                              alt={user.name || user.username || ""}
                            />
                            <AvatarFallback>
                              {user.name?.[0] || "U"}
                            </AvatarFallback>
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
          </div>
        </AnimatedSection>
      )}

      {/* 5. Metrics Insights for Plan Activities */}
      {metricsWithEnoughData.length > 0 && planActivities.length > 0 && (
        <AnimatedSection delay={backgroundImageUrl ? 0.45 : 0.4}>
          <div className="mb-12">
          <h3 className="text-lg font-semibold mb-2">Metrics Insights</h3>
          <p className="text-sm text-muted-foreground mb-4">
            See how this plan's activities correlate with your tracked metrics
          </p>
          <div className="space-y-4">
            {metricsWithEnoughData.map((metric) => (
              <div key={metric.id}>
                <MetricInsightsCard
                  metric={metric}
                  activities={planActivities}
                  activityEntries={activityEntries}
                  metricEntries={metricEntries || []}
                  onHelpClick={() => setHelpMetricId(metric.id)}
                />
                <CorrelationHelpPopover
                  isOpen={helpMetricId === metric.id}
                  onClose={() => setHelpMetricId(null)}
                  metricTitle={metric.title}
                />
              </div>
            ))}
          </div>
          <Link to="/insights/dashboard">
            <div className="flex items-center justify-center gap-3 p-4 rounded-2xl bg-muted cursor-pointer hover:bg-accent/50 transition-colors mt-4">
              <Activity className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">
                See full metrics dashboard
              </span>
            </div>
          </Link>
          </div>
        </AnimatedSection>
      )}

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

      <AnimatedSection delay={backgroundImageUrl ? 0.45 : 0.4}>
        <Link to="/add">
          <Button
          variant="outline"
          className="bg-muted/50 mt-4 w-full h-[100px] flex flex-col items-center justify-center border-2 border-dashed border-border text-muted-foreground"
        >
          <PlusSquare className="h-8 w-8 mb-2 text-muted-foreground/70" />
          <span>Log Activity</span>
          </Button>
        </Link>
      </AnimatedSection>

      <AppleLikePopover
        open={showLeaveGroupPopover}
        onClose={() => setShowLeaveGroupPopover(false)}
        title="Leave Plan Group"
      >
        <div className="flex flex-col gap-4 p-4">
          <h2 className="text-xl font-semibold text-center">
            Leave Plan Group?
          </h2>
          <p className="text-sm text-muted-foreground text-center">
            You'll leave this group but your plan and activities will remain
            intact. You can continue working on your plan independently.
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

      <ConfirmDialogOrPopover
        isOpen={showArchiveConfirm}
        onClose={() => setShowArchiveConfirm(false)}
        onConfirm={handleArchivePlan}
        title={
          <div className="flex items-center justify-center gap-2">
            <Archive className="h-6 w-6 text-muted-foreground" /> Archive Plan
          </div>
        }
        description="Archive this plan? You can restore it later from 'Show old & archived plans'."
        confirmText="Archive"
        cancelText="Cancel"
      />

      {/* Coaching Time Selector Popover */}
      <CoachingTimeSelector
        open={showCoachingTimeSelector}
        onClose={() => setShowCoachingTimeSelector(false)}
        onSave={handleSaveCoachingTime}
        currentStartHour={preferredCoachingHour}
      />

      {/* All Weeks Popover */}
      <AppleLikePopover
        open={showAllWeeksPopover}
        onClose={() => setShowAllWeeksPopover(false)}
        title="All Weeks"
      >
        <div className="flex flex-col gap-4 p-4 max-h-[70vh] overflow-y-auto">
          {allWeeksData.map((week, index) => {
            const isCurrentWeek = isSameWeek(week.startDate, new Date(), {
              weekStartsOn: 0,
            });
            const totalWeeks = planProgress?.weeks?.length ?? 0;
            const actualWeekIndex =
              planProgress?.weeks?.findIndex(
                (w) => w?.startDate.getTime() === week?.startDate.getTime()
              ) ?? index;

            return (
              <div
                key={actualWeekIndex}
                className="flex flex-col gap-2 p-3 rounded-2xl bg-card border border-border"
              >
                <PlanWeekDisplay
                  title={
                    <div className="flex justify-between items-center w-full">
                      <span className="text-lg font-semibold">
                        {isCurrentWeek
                          ? "Current week"
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
      </AppleLikePopover>

      {/* Pause Plan Popover */}
      <AppleLikePopover
        open={showPausePopover}
        onClose={() => {
          setShowPausePopover(false);
          setPauseReason("");
        }}
        title="Pause Plan"
      >
        <div className="flex flex-col gap-4 p-4">
          <div className="flex items-center gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
            <Pause className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              Streaks will still count down while your plan is paused.
            </p>
          </div>
          <div className="space-y-2">
            <label htmlFor="pause-reason" className="text-sm font-medium">
              Reason for pausing (optional)
            </label>
            <textarea
              id="pause-reason"
              value={pauseReason}
              onChange={(e) => setPauseReason(e.target.value)}
              placeholder="e.g., Going on vacation, taking a break..."
              className="w-full p-3 rounded-lg border border-border bg-background text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-yellow-500"
              rows={3}
            />
          </div>
          <div className="flex flex-col gap-2 mt-2">
            <Button
              onClick={handlePausePlan}
              disabled={isPausingPlan}
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-white"
            >
              {isPausingPlan ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Pausing...
                </>
              ) : (
                <>
                  <Pause className="h-4 w-4 mr-2" />
                  Pause Plan
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowPausePopover(false);
                setPauseReason("");
              }}
              disabled={isPausingPlan}
              className="w-full"
            >
              Cancel
            </Button>
          </div>
        </div>
      </AppleLikePopover>
    </motion.div>
  );
}
