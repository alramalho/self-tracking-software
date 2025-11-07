import { type CompletePlan } from "@/contexts/plans";
import { useThemeColors } from "@/hooks/useThemeColors";
import { cn } from "@/lib/utils";
import { getThemeVariants } from "@/utils/theme";
import { useNavigate } from "@tanstack/react-router";
import { format, isSameWeek } from "date-fns";
import { AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
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
import React, { useRef, useState } from "react";
import { FireAnimation } from "./FireBadge";
import { SteppedBarProgress } from "./SteppedBarProgress";
import { Collapsible, CollapsibleContent } from "./ui/collapsible";
import { Confetti, type ConfettiRef } from "./ui/confetti";

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
    backendProgress?.habitAchievement?.isAchieved ??
    achievement.streak >= FALLBACK_HABIT_WEEKS;

  const lifestyleProgressValue =
    backendProgress?.lifestyleAchievement?.progressValue ??
    Math.min(FALLBACK_LIFESTYLE_WEEKS, achievement.streak);
  const lifestyleMaxValue =
    backendProgress?.lifestyleAchievement?.maxValue ?? FALLBACK_LIFESTYLE_WEEKS;
  const lifestyleIsAchieved =
    backendProgress?.lifestyleAchievement?.isAchieved ??
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
            `rounded-3xl ring-1 flex flex-col gap-2 p-4 transition-all duration-300`,
            isCoached
              ? cn(
                  variants.veryFadedBg,
                  variants.ringBright,
                  "backdrop-blur-sm"
                )
              : "bg-card/90 ring-border",
            className
          )}
        >
          <div className="flex items-center justify-between gap-2 ">
            <div className="flex items-center gap-2">
              <span className="text-4xl">{plan.emoji || "📋"}</span>
              <span className="text-md font-semibold text-foreground">
                {plan.goal}
              </span>
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
              <div
                className={cn(
                  "flex items-center gap-1 px-3 py-1 rounded-full w-fit",
                  variants.fadedBg
                )}
              >
                <Sparkles size={18} className={variants.text} />
                <span className={cn("text-[12px] font-medium", variants.text)}>
                  Coached
                </span>
              </div>
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

            {/* Lifestyle achievement progress (9 weeks) - only show after habit is achieved */}
            {habitIsAchieved && !lifestyleIsAchieved && (
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
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};
