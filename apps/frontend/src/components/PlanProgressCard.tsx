import { useApiWithAuth } from "@/api";
import { useDataNotifications } from "@/contexts/notifications";
import {
  isWeekCompleted as checkIsWeekCompleted,
} from "@/contexts/PlanProgressContext/lib";
import { CompletePlan } from "@/contexts/plans";
import { usePlansProgress } from "@/contexts/PlansProgressContext";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useThemeColors } from "@/hooks/useThemeColors";
import { cn } from "@/lib/utils";
import { getThemeVariants } from "@/utils/theme";
import { useQueryClient } from "@tanstack/react-query";
import { Notification } from "@tsw/prisma";
import { format, isSameWeek } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  BadgeCheck,
  CircleCheck,
  Flame,
  Medal,
  MoveRight,
  RefreshCw,
  Sprout,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { MessageBubble } from "./MessageBubble";
import { SteppedBarProgress } from "./SteppedBarProgress";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
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
}

export const PlanProgressCard: React.FC<PlanProgressCardProps> = ({
  plan,
  weeks,
  achievement,
  isCoached = false,
  isExpanded = true,
  className,
  isDemo = false,
}) => {
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);
  const { notifications } = useDataNotifications();
  const { data: plansProgressData } = usePlansProgress([plan.id]);
  const queryClient = useQueryClient();
  const [isFullyDone, setIsFullyDone] = useState(false);
  const confettiRef = useRef<ConfettiRef>(null);

  const [isAnimationCompleted, setIsAnimationCompleted] =
    useState<boolean>(false);
  const [lastCoachMessage, setLastCoachMessage] = useState<string | undefined>(
    isDemo
      ? "Great progress this week! You're building a consistent habit. Keep it up!"
      : undefined
  );
  const [isGeneratingCoachMessage, setIsGeneratingCoachMessage] =
    useState(false);
  const api = useApiWithAuth();
  const [
    lastTimeCoachMessageWasGenerated,
    setLastTimeCoachMessageWasGenerated,
  ] = useLocalStorage<Date | undefined>(
    "last-coach-message-generated-at",
    undefined
  );

  // const canGenerateNewMessage = true
  const canGenerateNewMessage = useMemo(() => {
    if (isDemo) return false;
    if (!lastTimeCoachMessageWasGenerated) return true;
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    return new Date(lastTimeCoachMessageWasGenerated) < twoHoursAgo;
  }, [lastTimeCoachMessageWasGenerated, isDemo]);

  // Function to generate coach message
  const generateCoachMessage = async () => {
    if (isDemo || isGeneratingCoachMessage || !api) return;

    if (!canGenerateNewMessage) {
      console.log("Must wait 2 hours between coach message generations");
      return;
    }

    try {
      setIsGeneratingCoachMessage(true);
      const response = await api.post(
        "/ai/generate-coach-message",
        {},
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      setLastCoachMessage(response.data.message);
      setLastTimeCoachMessageWasGenerated(new Date());
      queryClient.refetchQueries({ queryKey: ["notifications"] }); // TODO: should we create an ai context?
    } catch (error) {
      console.error("Failed to generate coach message:", error);
    } finally {
      setIsGeneratingCoachMessage(false);
    }
  };

  // Initialize coach message from notifications data
  useEffect(() => {
    if (!isDemo && notifications) {
      const initialCoachMessage = notifications?.find(
        (notification: Notification) => notification.type === "COACH"
      )?.message;

      if (initialCoachMessage) {
        setLastCoachMessage(initialCoachMessage);
      }
    }
  }, [notifications, isDemo]);

  // Get current week data
  const currentWeek = weeks.find((week) =>
    isSameWeek(week.startDate, new Date())
  );

  if (!currentWeek) return null;

  // Calculate weekly progress
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

  // Get habit and lifestyle achievement from backend or fallback to local calculation
  const backendProgress = !isDemo ? plansProgressData?.find(p => p.plan?.id === plan.id) : null;
  const FALLBACK_HABIT_WEEKS = 4; // Fallback for demos/offline
  const FALLBACK_LIFESTYLE_WEEKS = 9; // Fallback for demos/offline
  
  // Habit achievement (4 weeks)
  const habitProgressValue = backendProgress?.habitAchievement?.progressValue ?? 
    Math.min(FALLBACK_HABIT_WEEKS, achievement.streak);
  const habitMaxValue = backendProgress?.habitAchievement?.maxValue ?? FALLBACK_HABIT_WEEKS;
  const habitIsAchieved = backendProgress?.habitAchievement?.isAchieved ?? 
    (achievement.streak >= FALLBACK_HABIT_WEEKS);
    
  // Lifestyle achievement (9 weeks)
  const lifestyleProgressValue = backendProgress?.lifestyleAchievement?.progressValue ?? 
    Math.min(FALLBACK_LIFESTYLE_WEEKS, achievement.streak);
  const lifestyleMaxValue = backendProgress?.lifestyleAchievement?.maxValue ?? FALLBACK_LIFESTYLE_WEEKS;
  const lifestyleIsAchieved = backendProgress?.lifestyleAchievement?.isAchieved ?? 
    (achievement.streak >= FALLBACK_LIFESTYLE_WEEKS);

  const isWeekCompleted = checkIsWeekCompleted(
    currentWeek.startDate,
    plan,
    currentWeek.completedActivities
  );
  const isCurrentWeek = isSameWeek(currentWeek.startDate, new Date());
  const showConfetti = isCurrentWeek && isWeekCompleted;

  return (
    <Collapsible open={isExpanded}>
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
          <div className="px-3">
            <div className="flex items-center gap-2 pr-[5rem]">
              <span className="text-xl">{plan.emoji || "📋"}</span>
              <div className="flex flex-col gap-1">
                <span className="text-md font-semibold text-gray-800">
                  {plan.goal}
                </span>
              </div>
            </div>
            {isCoached && (
              <div className="absolute top-1 right-1 opacity-40">
                <div className="flex items-center gap-1 p-2">
                  <BadgeCheck className={cn("h-5 w-5", variants.text)} />
                </div>
              </div>
            )}
          </div>

          {isCoached && (
            <>
              <div className="flex flex-col items-center gap-1 py-2">
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
              </div>
              <AnimatePresence>
                {isAnimationCompleted && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  >
                    <div className="flex flex-row items-center justify-between bg-transparent rounded-md">
                      <span className="text-xs text-gray-400/80">
                        This week
                      </span>
                      <PlanStatus plan={plan} />
                      {["COMPLETED", "FAILED"].includes(
                        plan?.currentWeekState || ""
                      ) && (
                        <Link
                          href={`/plans?selectedPlan=${plan.id}`}
                          className="text-[12px] text-gray-400 hover:text-gray-700 transition-colors p-1 px-3"
                        >
                          Coach notes <MoveRight className="h-4 w-4 inline" />
                        </Link>
                      )}
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
              onAnimationCompleted={() => setIsAnimationCompleted(true)}
              className="w-full"
              onFullyDone={() => setIsFullyDone(true)}
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
