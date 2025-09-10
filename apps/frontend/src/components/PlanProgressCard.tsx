import { isWeekCompleted as checkIsWeekCompleted } from "@/contexts/PlanProgressContext/lib";
import { CompletePlan } from "@/contexts/plans";
import { usePlansProgress } from "@/contexts/PlansProgressContext";
import { useThemeColors } from "@/hooks/useThemeColors";
import { cn } from "@/lib/utils";
import { getThemeVariants } from "@/utils/theme";
import { format, isSameWeek } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  CircleCheck,
  Flame,
  Medal,
  MoveRight,
  Sprout,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useRef, useState } from "react";
import { FireAnimation } from "./FireBadge";
import { SteppedBarProgress } from "./SteppedBarProgress";
import { Collapsible, CollapsibleContent } from "./ui/collapsible";
import { Confetti, ConfettiRef } from "./ui/confetti";

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
        className={`text-sm font-medium italic text-gray-500 uppercase animate-pulse`}
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
  isCoached?: boolean;
  isExpanded?: boolean;
  className?: string;
  isDemo?: boolean;
  onAnimationDone?: () => void;
  skipAnimation?: boolean;
}

export const PlanProgressCard: React.FC<PlanProgressCardProps> = ({
  plan,
  weeks,
  achievement,
  isCoached = false,
  isExpanded = true,
  className,
  isDemo = false,
  onAnimationDone,
  skipAnimation = false,
}) => {
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);
  const { data: plansProgressData } = usePlansProgress(isDemo ? [] : [plan.id]);
  const [isFullyDone, setIsFullyDone] = useState(false);
  const confettiRef = useRef<ConfettiRef>(null);
  const router = useRouter();

  const [isAnimationCompleted, setIsAnimationCompleted] =
    useState<boolean>(false);
  const [completedAnimations, setCompletedAnimations] = useState<Set<string>>(new Set());

  const currentWeek = weeks.find((week) =>
    isSameWeek(week.startDate, new Date())
  );

  if (!currentWeek) return null;

  const totalPlannedActivities =
    plan.outlineType === "TIMES_PER_WEEK"
      ? (currentWeek.plannedActivities as number)
      : (currentWeek.plannedActivities as any[])?.length || 0;

  const uniqueDaysWithActivities = new Set(
    currentWeek.completedActivities.map((entry: any) =>
      format(new Date(entry.date), "yyyy-MM-dd")
    )
  );

  const totalCompletedActivities = uniqueDaysWithActivities.size;

  const backendProgress = !isDemo
    ? plansProgressData?.find((p) => p.plan?.id === plan.id)
    : null;
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

  const isWeekCompleted = checkIsWeekCompleted(
    currentWeek.startDate,
    plan,
    currentWeek.completedActivities
  );
  const isCurrentWeek = isSameWeek(currentWeek.startDate, new Date());
  const showConfetti = isCurrentWeek && isWeekCompleted;

  // Calculate total number of animations that will run
  const totalProgressBars = 2 + (achievement.streak >= habitMaxValue ? 1 : 0); // week + habit + (lifestyle if applicable)
  const totalAnimations = totalProgressBars + (isCoached ? 1 : 0); // + PlanStatus motion if coached
  
  const handleAnimationComplete = (animationId: string) => {
    if (skipAnimation) {
      // If skipping animation, call onAnimationDone immediately
      setIsAnimationCompleted(true);
      onAnimationDone?.();
      return;
    }
    
    setCompletedAnimations(prev => {
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
            setCompletedAnimations(prev => {
              const finalSet = new Set(prev);
              finalSet.add('planStatus');
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
              : "bg-white/60 ring-gray-200",
            className
          )}
        >
          <div className="flex items-center justify-between gap-2 ">
            <div className="flex items-center gap-2">
              <span className="text-4xl">{plan.emoji || "📋"}</span>
              <div className="flex flex-col gap-1">
                <span className="text-md font-semibold text-gray-800">
                  {plan.goal}
                </span>
              </div>
            </div>
            <div
              className={cn(
                "flex items-center transition-all duration-300 relative",
                achievement.streak == 0 ? "grayscale opacity-50" : ""
              )}
            >
              {achievement.streak > 1 && (
                <span className="text-lg font-cursive">
                  x{achievement.streak}
                </span>
              )}
              <FireAnimation height={40} width={40} className="pb-2" />
            </div>
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
                            ? "text-gray-400"
                            : "text-gray-500"
                        }`}
                      >
                        {lastCoachMessage}
                      </span>
                      <span className="text-[10px] italic text-gray-400">
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
                          ? "hover:bg-white/20 text-gray-600 hover:text-gray-800 cursor-pointer"
                          : "text-gray-300 cursor-not-allowed"
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
                    initial={skipAnimation ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={skipAnimation ? { duration: 0 } : { duration: 0.5, ease: "easeOut" }}
                  >
                    <div className="flex flex-row items-center justify-between bg-transparent rounded-md">
                      <span className="text-xs text-gray-400/80">
                        This week
                      </span>
                      <div
                        onClick={() => {
                          router.push(`/plans?selectedPlan=${plan.id}`);
                        }}
                      >
                        <div className="flex flex-row items-center gap-2">
                          <PlanStatus plan={plan} />
                          <MoveRight className="h-4 w-4 text-gray-400" />
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
              onAnimationCompleted={() => handleAnimationComplete('week')}
              className="w-full"
              onFullyDone={() => {
                setTimeout(() => {
                  setIsFullyDone(true);
                }, 500);
              }}
              skipAnimation={skipAnimation}
            />

            {/* Habit achievement progress (4 weeks) */}
            <div className="space-y-1">
              <SteppedBarProgress
                value={habitProgressValue}
                maxValue={habitMaxValue}
                goal={<Sprout size={19} className="text-lime-500" />}
                className={cn("w-full")}
                color="bg-lime-400"
                celebration={
                  habitIsAchieved ? (
                    <span className="flex items-center gap-1">
                      <CircleCheck size={19} className="text-green-500" />
                      <span className="text-xs font-normal text-gray-500">
                        It&apos;s a habit!
                      </span>
                    </span>
                  ) : undefined
                }
                onAnimationCompleted={() => handleAnimationComplete('habit')}
                skipAnimation={skipAnimation}
              />
            </div>

            {/* Lifestyle achievement progress (9 weeks) - only show after habit is achieved */}
            {achievement.streak >= habitMaxValue && (
              <div className="space-y-1">
                <SteppedBarProgress
                  value={lifestyleProgressValue}
                  maxValue={lifestyleMaxValue}
                  goal={<Medal size={19} className="text-amber-400" />}
                  className={cn("w-full")}
                  color={variants.bg}
                  celebration={
                    lifestyleIsAchieved ? (
                      <span className="flex items-center gap-1">
                        <CircleCheck size={19} className="text-green-500" />
                        <span className="text-xs font-normal text-gray-500">
                          Part of your lifestyle!
                        </span>
                      </span>
                    ) : undefined
                  }
                  onAnimationCompleted={() => handleAnimationComplete('lifestyle')}
                  skipAnimation={skipAnimation}
                />
              </div>
            )}

            <AnimatePresence>
              {showConfetti && isFullyDone && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                  animate={{ opacity: 1, height: "auto", marginTop: 16 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  transition={{ delay: 0.3, duration: 0.6, ease: "easeOut" }}
                  className="overflow-hidden"
                >
                  <Confetti
                    className="absolute left-0 top-0 z-0 size-full"
                    ref={confettiRef}
                    manualstart
                  />
                  <div
                    className="relative p-3 rounded-lg backdrop-blur-sm bg-gradient-to-br from-green-200/40 via-green-100/40 to-emerald-200/40 border border-green-200 animate-background-position-spin bg-[length:200%_200%]"
                    onClick={() => {
                      confettiRef.current?.fire({});
                    }}
                  >
                    <div className="relative z-10 flex items-center justify-center">
                      <span className="text-md font-semibold text-green-700 pointer-events-none select-none animate-pulse">
                        🎉 Fantastic work this week!
                      </span>
                    </div>
                  </div>
                </motion.div>
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
