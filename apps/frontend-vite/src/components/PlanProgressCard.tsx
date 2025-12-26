import { useApiWithAuth } from "@/api";
import { useActivities } from "@/contexts/activities/useActivities";
import { type CompletePlan } from "@/contexts/plans";
import { useSessionMessage, type SessionSnapshot } from "@/contexts/session-message";
import { useThemeColors } from "@/hooks/useThemeColors";
import { cn } from "@/lib/utils";
import { getThemeVariants } from "@/utils/theme";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format, isSameWeek, isAfter, startOfDay, isSameDay } from "date-fns";
import { AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  ChevronRight,
  CircleCheck,
  Flame,
  MoveRight,
  Rocket,
  Sparkles,
  Sprout,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { motion } from "motion/react";
import React, { useMemo, useRef, useState } from "react";
import { FireAnimation } from "./FireBadge";
import { SteppedBarProgress } from "./SteppedBarProgress";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Collapsible, CollapsibleContent } from "./ui/collapsible";
import { Confetti, type ConfettiRef } from "./ui/confetti";

interface HumanCoach {
  id: string;
  ownerId: string;
  type: "HUMAN";
  details: {
    title: string;
    bio?: string;
    focusDescription: string;
  };
  owner: {
    id: string;
    username: string;
    name: string | null;
    picture: string | null;
  };
}

interface ComingUpSectionProps {
  sessions: any[];
  activities: any[];
  variants: any;
  plan: CompletePlan;
  coachUsername?: string;
  onTalkToCoach?: (sessionSnapshot: SessionSnapshot) => void;
}

const ComingUpSection: React.FC<ComingUpSectionProps> = ({
  sessions,
  activities,
  variants,
  plan,
  coachUsername,
  onTalkToCoach,
}) => {
  const [selectedSession, setSelectedSession] = useState<any | null>(null);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  const handleTalkToCoach = () => {
    if (!selectedSession || !coachUsername || !onTalkToCoach) return;

    const sessionSnapshot: SessionSnapshot = {
      activityId: selectedSession.activityId,
      activityTitle: selectedSession.activity.title,
      activityEmoji: selectedSession.activity.emoji || null,
      activityMeasure: selectedSession.activity.measure || "",
      date: new Date(selectedSession.date).toISOString(),
      quantity: selectedSession.quantity,
      descriptiveGuide: selectedSession.descriptiveGuide,
      planId: plan.id,
      planGoal: plan.goal,
      planEmoji: plan.emoji || null,
      coachUsername,
    };

    onTalkToCoach(sessionSnapshot);
  };

  return (
    <div className="mt-2 pt-2 border-t border-border/50">
      <span className="text-xs text-muted-foreground">Coming up:</span>
      <div className="flex flex-nowrap gap-2 overflow-x-auto mt-2 pb-1">
        {sessions.map((session) => {
          const activity = activities.find(
            (a: any) => a.id === session.activityId
          );
          if (!activity) return null;
          const sessionKey = `${session.date}-${session.activityId}`;
          const isSelected = selectedSession?.key === sessionKey;

          return (
            <button
              key={sessionKey}
              onClick={() => {
                setIsDescriptionExpanded(false);
                setSelectedSession(
                  isSelected ? null : { ...session, activity, key: sessionKey }
                );
              }}
              className={cn(
                "flex flex-col items-center gap-1 p-2 rounded-lg border text-center min-w-[70px] transition-all",
                isSelected
                  ? cn(variants.brightBorder, variants.veryFadedBg)
                  : "border-border bg-muted/50 hover:border-muted-foreground/30"
              )}
            >
              <span className="text-xl">{activity.emoji || "📋"}</span>
              <span className="text-[10px] text-muted-foreground font-medium">
                {format(new Date(session.date), "EEE d")}
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected session detail */}
      <AnimatePresence mode="wait">
        {selectedSession && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div
              className={cn(
                "mt-2 p-3 rounded-xl border",
                variants.brightBorder,
                variants.veryFadedBg
              )}
            >
              <div className="flex items-center gap-2">
                <span className="text-2xl">
                  {selectedSession.activity.emoji || "📋"}
                </span>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-foreground truncate">
                    {selectedSession.activity.title}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(selectedSession.date), "EEEE, MMM d")}
                    {selectedSession.quantity && (
                      <>
                        {" "}
                        • {selectedSession.quantity}{" "}
                        {selectedSession.activity.measure}
                      </>
                    )}
                  </p>
                </div>
              </div>

              {selectedSession.descriptiveGuide && (
                <div className="mt-2">
                  <p className={cn(
                    "text-xs text-muted-foreground",
                    !isDescriptionExpanded && selectedSession.descriptiveGuide.length > 80 && "line-clamp-1"
                  )}>
                    {selectedSession.descriptiveGuide}
                  </p>
                  {selectedSession.descriptiveGuide.length > 80 && (
                    <button
                      onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                      className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                    >
                      {isDescriptionExpanded ? "Show less" : "Read more"}
                    </button>
                  )}
                </div>
              )}

              {/* Talk to coach link */}
              {coachUsername && onTalkToCoach && (
                <button
                  onClick={handleTalkToCoach}
                  className="mt-2 flex items-center gap-1 text-[10px] font-mono uppercase tracking-wide text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                >
                  <span>Talk to coach about this</span>
                  <ChevronRight size={12} />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const PlanStatus = ({ plan }: { plan: CompletePlan }) => {
  if (!plan?.currentWeekState) {
    return null;
  }
  const statusConfig = {
    ON_TRACK: {
      icon: <TrendingUp className="h-5 w-5 text-green-500" />,
      message: "On track!",
    },
    AT_RISK: {
      icon: <AlertTriangle className="h-5 w-5 text-amber-500" />,
      message: "At risk",
    },
    FAILED: {
      icon: <TrendingDown className="h-5 w-5 text-red-500" />,
      message: "Off track!",
    },
    COMPLETED: {
      icon: <CircleCheck className="h-5 w-5 text-green-500" />,
      message: "Week completed!",
    },
  };

  const config = statusConfig[plan.currentWeekState];

  return (
    <div className="flex items-center gap-2">
      {config.icon}
      <span
        className={`text-sm font-medium italic text-muted-foreground uppercase animate-pulse`}
      >
        {config.message}
      </span>
    </div>
  );
};

interface PlanProgressCardProps {
  plan: CompletePlan;
  weeks: any[];
  achievement: any;
  isExpanded?: boolean;
  className?: string;
  isDemo?: boolean;
  onAnimationDone?: () => void;
  skipAnimation?: boolean;
  onFireClick?: () => void;
}

export const PlanProgressCard: React.FC<PlanProgressCardProps> = ({
  plan,
  weeks,
  achievement,
  isExpanded = true,
  className,
  isDemo = false,
  onAnimationDone,
  skipAnimation = false,
  onFireClick,
}) => {
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);
  const [isFullyDone, setIsFullyDone] = useState(false);
  const confettiRef = useRef<ConfettiRef>(null);
  const navigate = useNavigate();
  const planProgressData = plan.progress;
  const { activities, activityEntries } = useActivities();
  const { setPendingSession } = useSessionMessage();
  const api = useApiWithAuth();

  // Fetch coaches to get coach info for coached plans
  const { data: humanCoaches } = useQuery({
    queryKey: ["coaches"],
    queryFn: async () => {
      const response = await api.get<HumanCoach[]>("/coaches");
      return response.data;
    },
    enabled: !!(plan as any).coachId && (plan as any).isCoached,
  });

  // Find the coach for this plan
  const planCoach = useMemo(() => {
    if (!humanCoaches || !(plan as any).coachId) return null;
    return humanCoaches.find((c) => c.id === (plan as any).coachId) || null;
  }, [humanCoaches, (plan as any).coachId]);

  // Get upcoming sessions for SPECIFIC plans
  const upcomingSessions = React.useMemo(() => {
    if (plan.outlineType !== "SPECIFIC" || !plan.sessions) return [];

    const today = startOfDay(new Date());
    return plan.sessions
      .filter((session) => {
        const sessionDate = startOfDay(new Date(session.date));
        // Include today and future sessions
        return isAfter(sessionDate, today) || isSameDay(sessionDate, today);
      })
      .filter((session) => {
        // Filter out completed sessions
        const isCompleted = activityEntries.some(
          (entry) =>
            entry.activityId === session.activityId &&
            isSameDay(new Date(entry.datetime), new Date(session.date))
        );
        return !isCompleted;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 3); // Show next 3 upcoming
  }, [plan, activityEntries]);

  const [isAnimationCompleted, setIsAnimationCompleted] =
    useState<boolean>(false);
  const [completedAnimations, setCompletedAnimations] = useState<Set<string>>(
    new Set()
  );

  const currentWeek = weeks?.find((week) =>
    isSameWeek(week.startDate, new Date())
  );

  if (!currentWeek) return null;

  const totalPlannedActivities =
    plan.outlineType === "TIMES_PER_WEEK"
      ? (currentWeek.plannedActivities as number)
      : (currentWeek.plannedActivities as any[])?.length || 0;

  const uniqueDaysWithActivities = new Set(
    currentWeek.completedActivities.map((entry: any) => {
      return format(new Date(entry.datetime || entry.date), "yyyy-MM-dd");
    })
  );

  const totalCompletedActivities = uniqueDaysWithActivities.size;

  const backendProgress = !isDemo ? planProgressData : null;
  const FALLBACK_HABIT_WEEKS = 4;
  const FALLBACK_LIFESTYLE_WEEKS = 9;

  const habitProgressValue =
    backendProgress?.habitAchievement?.progressValue ??
    Math.min(FALLBACK_HABIT_WEEKS, achievement.streak);
  const habitMaxValue =
    backendProgress?.habitAchievement?.maxValue ?? FALLBACK_HABIT_WEEKS;
  const habitIsAchieved =
    backendProgress?.habitAchievement?.isAchieved ||
    achievement.streak >= FALLBACK_HABIT_WEEKS;

  const lifestyleProgressValue =
    backendProgress?.lifestyleAchievement?.progressValue ??
    Math.min(FALLBACK_LIFESTYLE_WEEKS, achievement.streak);
  const lifestyleMaxValue =
    backendProgress?.lifestyleAchievement?.maxValue ?? FALLBACK_LIFESTYLE_WEEKS;
  const lifestyleIsAchieved =
    backendProgress?.lifestyleAchievement?.isAchieved ||
    achievement.streak >= FALLBACK_LIFESTYLE_WEEKS;

  // Calculate if week is completed from current week data
  const isWeekCompleted =
    plan.outlineType === "TIMES_PER_WEEK"
      ? totalCompletedActivities >= totalPlannedActivities
      : totalCompletedActivities === totalPlannedActivities;
  const isCurrentWeek = isSameWeek(currentWeek.startDate, new Date());
  const showConfetti = isCurrentWeek && isWeekCompleted;
  const isCoached = plan.isCoached;

  // Calculate total number of animations that will run
  const totalProgressBars =
    1 +
    (!habitIsAchieved ? 1 : 0) +
    (achievement.streak >= habitMaxValue ? 1 : 0); // week + (habit if not achieved) + (lifestyle if applicable)
  const totalAnimations = totalProgressBars + (isCoached ? 1 : 0); // + PlanStatus motion if coached

  const handleAnimationComplete = (animationId: string) => {
    if (skipAnimation) {
      // If skipping animation, call onAnimationDone immediately
      setIsAnimationCompleted(true);
      onAnimationDone?.();
      return;
    }

    setCompletedAnimations((prev) => {
      const newSet = new Set(prev);
      newSet.add(animationId);

      // Check if all progress bar animations are complete
      if (newSet.size >= totalProgressBars) {
        setIsAnimationCompleted(true);

        // If not coached, we're done. If coached, wait for PlanStatus animation
        if (!isCoached) {
          onAnimationDone?.();
        } else {
          // Wait for PlanStatus animation to complete (0.5s)
          setTimeout(() => {
            setCompletedAnimations((prev) => {
              const finalSet = new Set(prev);
              finalSet.add("planStatus");
              if (finalSet.size >= totalAnimations) {
                onAnimationDone?.();
              }
              return finalSet;
            });
          }, 500);
        }
      }

      return newSet;
    });
  };

  return (
    <Collapsible open={isExpanded} className="relative">
      <CollapsibleContent className="space-y-0 overflow-visible">
        <div
          className={cn(
            `rounded-3xl ring-1 flex flex-col gap-2 p-4 transition-all duration-300 bg-card/90 ring-border`,
            className
          )}
        >
          <div className="flex items-center justify-between gap-2 ">
            <div className="flex items-center gap-2">
              <span className="text-4xl">{plan.emoji || "📋"}</span>
              <div className="flex flex-col">
                <span className="text-md font-semibold text-foreground">
                  {plan.goal}
                </span>
              </div>
            </div>
            <div
              className={cn(
                "flex items-center gap-1 transition-all duration-300 relative",
                achievement.streak == 0 ? "grayscale opacity-50" : ""
              )}
              onClick={() => {
                onFireClick?.();
              }}
            >
              <>
                <span className="text-lg font-cursive">
                  x{achievement.streak}
                </span>
                <FireAnimation height={40} width={40} className="pb-2" />
              </>
            </div>
          </div>

          {/* Badges row - beneath the title */}
          <div className="flex items-center gap-2 flex-wrap">
            {isCoached && (
              <>
                {planCoach ? (
                  <div className="flex items-center gap-1 w-full justify-between">
                    <div className="flex items-center gap-2 pt-2 pb-4">
                      <Avatar onClick={() => navigate({ to: `/messages/${planCoach.owner.username}` })} className={cn("w-5 h-5 ring-1 ring-offset-1 ring-offset-card cursor-pointer", variants.ring, variants.veryFadedBg)}>
                        <AvatarImage src={planCoach.owner.picture || ""} />
                        <AvatarFallback className="text-[8px]">
                          {planCoach.owner.name?.[0] || "C"}
                        </AvatarFallback>
                      </Avatar>
                      <p className="text-xs text-white/70">
                        Coached by <a href={`/messages/${planCoach.owner.username}`}><span className={cn("font-medium hover:underline cursor-pointer", variants.text)}>{planCoach.owner.name || planCoach.owner.username}</span></a>
                      </p>
                    </div>
                    <div onClick={() => navigate({ to: `/plans?selectedPlan=${plan.id}` })} className="flex items-center gap-1 ml-2 cursor-pointer opacity-70">
                      <span className="text-xs text-white/70">See full plan</span>
                      <ChevronRight className="h-3 w-3" />
                    </div>
                  </div>
                ) : (
                  <>
                    <div
                      className={cn(
                        "flex items-center justify-between gap-1.5 px-2 py-1 rounded-full w-fit",
                        variants.fadedBg
                      )}
                    >
                      <Sparkles size={16} className={variants.text} />
                      <span className={cn("text-[12px] font-medium", variants.text)}>
                        Coached
                      </span>
                    </div>
                  </>
                )}
              </>
            )}
            {habitIsAchieved && (
              <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-lime-100 dark:bg-lime-900/30 w-fit">
                <Sprout size={18} className="text-lime-500" />
                <span className="text-[12px] font-medium text-lime-500">
                  Habit
                </span>
              </div>
            )}
            {isWeekCompleted && (
              <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/30 w-fit">
                🎉{" "}
                <span className="text-[12px] font-medium text-green-500">
                  Week completed
                </span>
              </div>
            )}
          </div>

          {isCoached && (
            <>
              {/* <div className="flex flex-col items-center gap-1 py-2">
                <MessageBubble
                  direction="left"
                  className="bg-white/60 backdrop-blur-sm ring-1 ring-white/50 shadow-lg"
                >
                  <div className="flex items-center gap-2">
                    <Avatar>
                      <AvatarImage src="https://alramalhosandbox.s3.eu-west-1.amazonaws.com/tracking_software/jarvis_logo_transparent.png" />
                      <AvatarFallback>CN</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col gap-1 flex-1">
                      <span
                        className={`text-sm italic ${
                          isGeneratingCoachMessage || !canGenerateNewMessage
                            ? "text-muted-foreground/60"
                            : "text-muted-foreground"
                        }`}
                      >
                        {lastCoachMessage}
                      </span>
                      <span className="text-[10px] italic text-muted-foreground/60">
                        Coach Oli
                      </span>
                    </div>
                    <button
                      onClick={generateCoachMessage}
                      disabled={
                        isGeneratingCoachMessage || !canGenerateNewMessage
                      }
                      className={cn(
                        "p-1 rounded-full transition-all duration-200",
                        canGenerateNewMessage && !isGeneratingCoachMessage
                          ? "hover:bg-white/20 text-muted-foreground hover:text-foreground cursor-pointer"
                          : "text-muted-foreground/30 cursor-not-allowed"
                      )}
                      title={
                        !canGenerateNewMessage
                          ? "Wait 2 hours between message generations"
                          : "Generate new coach message"
                      }
                    >
                      <RefreshCw
                        className={cn(
                          "h-4 w-4",
                          isGeneratingCoachMessage && "animate-spin"
                        )}
                      />
                    </button>
                  </div>
                </MessageBubble>
              </div> */}
              <AnimatePresence>
                {isAnimationCompleted && (
                  <motion.div
                    initial={
                      skipAnimation
                        ? { opacity: 1, y: 0 }
                        : { opacity: 0, y: 20 }
                    }
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={
                      skipAnimation
                        ? { duration: 0 }
                        : { duration: 0.5, ease: "easeOut" }
                    }
                  >
                    <div className="flex flex-row items-center justify-between bg-transparent rounded-md">
                      <span className="text-xs text-muted-foreground/80">
                        This week
                      </span>
                      <div
                        onClick={() => {
                          navigate({ to: `/plans?selectedPlan=${plan.id}` });
                        }}
                      >
                        <div className="flex flex-row items-center gap-2">
                          <PlanStatus plan={plan} />
                          <MoveRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}

          {/* Current week progress with animated legend */}
          <div className="space-y-2">
            <SteppedBarProgress
              value={totalCompletedActivities}
              maxValue={totalPlannedActivities}
              goal={<Flame size={19} className="text-orange-400" />}
              onAnimationCompleted={() => handleAnimationComplete("week")}
              className="w-full"
              onFullyDone={() => {
                setTimeout(() => {
                  setIsFullyDone(true);
                }, 500);
              }}
              skipAnimation={skipAnimation}
            />

            {/* Habit achievement progress (4 weeks) - hide when achieved */}
            {!habitIsAchieved && (
              <div className="space-y-1">
                <SteppedBarProgress
                  value={habitProgressValue}
                  maxValue={habitMaxValue}
                  goal={<Sprout size={19} className="text-lime-500" />}
                  className={cn("w-full")}
                  color="bg-lime-400"
                  onAnimationCompleted={() => handleAnimationComplete("habit")}
                  skipAnimation={skipAnimation}
                />
              </div>
            )}

            {/* Lifestyle achievement progress (9 weeks) - show after habit is achieved */}
            {habitIsAchieved && (
              <div className="space-y-1">
                <SteppedBarProgress
                  value={lifestyleProgressValue}
                  maxValue={lifestyleMaxValue}
                  goal={<Rocket size={19} className="text-amber-400" />}
                  className={cn("w-full")}
                  color={"bg-amber-400"}
                  celebration={
                    lifestyleIsAchieved ? (
                      <span className="flex items-center gap-1">
                        <CircleCheck size={19} className="text-green-500" />
                        <span className="text-xs font-normal text-muted-foreground">
                          Part of your lifestyle!
                        </span>
                      </span>
                    ) : undefined
                  }
                  onAnimationCompleted={() =>
                    handleAnimationComplete("lifestyle")
                  }
                  skipAnimation={skipAnimation}
                />
              </div>
            )}

            <AnimatePresence>
              {showConfetti && isFullyDone && (
                <Confetti
                  className="absolute left-0 top-0 z-0 size-full"
                  ref={confettiRef}
                  manualstart
                />
              )}
            </AnimatePresence>

            {/* Confetti animation for completed weeks */}
            {/* <AnimatePresence>
              {showConfetti && (
                <div className="fixed top-1/2 left-0 w-screen h-screen pointer-events-none z-[101]">
                  <Confetti mode="boom" particleCount={150} />
                </div>
              )}
            </AnimatePresence> */}
          </div>

          {/* Coming up section for SPECIFIC plans */}
          {plan.outlineType === "SPECIFIC" && upcomingSessions.length > 0 && (
            <ComingUpSection
              sessions={upcomingSessions}
              activities={activities}
              variants={variants}
              plan={plan}
              coachUsername={planCoach?.owner.username}
              onTalkToCoach={(sessionSnapshot) => {
                setPendingSession(sessionSnapshot);
                navigate({ to: `/messages/${sessionSnapshot.coachUsername}` });
              }}
            />
          )}

        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};
