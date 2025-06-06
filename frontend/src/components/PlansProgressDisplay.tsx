import React, { useState, useEffect, useMemo } from "react";
import { isSameWeek, format, isToday, isBefore } from "date-fns";
import { cn } from "@/lib/utils";
import { usePlanProgress } from "@/contexts/PlanProgressContext";
import {
  ACHIEVEMENT_WEEKS,
  isWeekCompleted as checkIsWeekCompleted,
} from "@/contexts/PlanProgressContext/lib";
import { SteppedBarProgress } from "./SteppedBarProgress";
import FireBadge from "./FireBadge";
import {
  Plan,
  PlanSession,
  useUserPlan,
  Notification,
} from "@/contexts/UserPlanContext";
import { AnimatePresence } from "framer-motion";
import Confetti from "react-confetti-boom";
import { useThemeColors } from "@/hooks/useThemeColors";
import { getThemeVariants } from "@/utils/theme";
import {
  BadgeCheck,
  CircleCheck,
  Flame,
  Loader2,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  RefreshCw,
  MoveRight,
} from "lucide-react";
import { Medal } from "lucide-react";
import { Collapsible, CollapsibleContent } from "./ui/collapsible";
import { usePaidPlan } from "@/hooks/usePaidPlan";
import { MessageBubble } from "./MessageBubble";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useApiWithAuth } from "@/api";
import Link from "next/link";
import { Button } from "./ui/button";
import { motion } from "framer-motion";

const PlanStatus = ({ plan }: { plan: Plan }) => {
  console.log("plan STATUS", plan);
  if (!plan?.current_week?.state) {
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

  const config = statusConfig[plan.current_week.state];

  return (
    <div className="flex flex-row items-center justify-between bg-transparent rounded-md">
      <div className="flex items-center gap-2">
        {config.icon}
        <span
          className={`text-sm font-medium italic text-gray-500 uppercase animate-pulse`}
        >
          {config.message}
        </span>
      </div>
      <Link
        href={`/plans?selectedPlan=${plan.id}`}
        className="text-[12px] text-gray-400 hover:text-gray-700 transition-colors p-1 px-3"
      >
        Coach notes <MoveRight className="h-4 w-4 inline" />
      </Link>
    </div>
  );
};

interface PlansProgressDisplayProps {
  plans: Plan[];
  isExpanded: boolean;
  className?: string;
}

export const PlansProgressDisplay: React.FC<PlansProgressDisplayProps> = ({
  plans,
  isExpanded,
  className,
}) => {
  const { userPaidPlanType } = usePaidPlan();
  const [canDisplayLifestyleAchieved, setCanDisplayLifestyleAchieved] =
    useState(false);
  const { plansProgress } = usePlanProgress();

  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);
  const { notificationsData } = useUserPlan();

  const [isAnimationCompleted, setIsAnimationCompleted] = useState<boolean>(false);
  const [lastCoachMessage, setLastCoachMessage] = useState<string | undefined>(
    undefined
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

  const canGenerateNewMessage = useMemo(() => {
    if (!lastTimeCoachMessageWasGenerated) return true;
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    return isBefore(lastTimeCoachMessageWasGenerated, twoHoursAgo);
  }, [lastTimeCoachMessageWasGenerated]);

  // Function to generate coach message
  const generateCoachMessage = async () => {
    if (isGeneratingCoachMessage) return;

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
            // Add your auth headers here if needed
          },
        }
      );

      setLastCoachMessage(response.data.message);
      setLastTimeCoachMessageWasGenerated(new Date());
      notificationsData.refetch();
    } catch (error) {
      console.error("Failed to generate coach message:", error);
    } finally {
      setIsGeneratingCoachMessage(false);
    }
  };

  // Initialize coach message from notifications data
  useEffect(() => {
    if (notificationsData?.data?.notifications) {
      const initialCoachMessage = notificationsData?.data?.notifications?.find(
        (notification: Notification) => notification.type === "coach"
      )?.message;

      if (initialCoachMessage) {
        setLastCoachMessage(initialCoachMessage);
      }
    }
  }, []);

  // Helper function to check if a streak was achieved this week
  const wasStreakAchievedThisWeek = (planProgressData: any) => {
    const currentWeek = planProgressData.weeks?.find((week: any) =>
      isSameWeek(week.startDate, new Date())
    );

    if (!currentWeek || !currentWeek.completedActivities?.length) {
      return false;
    }

    return (
      planProgressData.achievement.streak > 0 &&
      currentWeek.completedActivities.length > 0
    );
  };

  function getSessionId(session: PlanSession) {
    return `${session.date}-${session.activity_id}`;
  }

  function getSessionById(
    plan: Plan,
    sessionId: string
  ): PlanSession | undefined {
    return plan.sessions.find((session) => getSessionId(session) === sessionId);
  }

  return (
    <div className={cn("w-full flex flex-col", className)}>
      {/* Fire badges section */}
      <Collapsible open={isExpanded}>
        <CollapsibleContent className="space-y-0">
          <div className="flex flex-col gap-3 p-2 rounded-lg bg-gray-100/70">
            <span className="text-sm font-medium text-gray-700">Streaks</span>
            <div className="flex flex-wrap gap-3">
              {plansProgress.map((planProgressData) => {
                const { plan, achievement } = planProgressData;
                const isNewThisWeek =
                  wasStreakAchievedThisWeek(planProgressData);

                return (
                  <div key={plan.id} className="flex items-center gap-2">
                    <div
                      className={cn(
                        "overflow-visible transition-all duration-300 h-[50px] w-[50px] relative",
                        achievement.streak == 0 ? "grayscale opacity-50" : ""
                      )}
                    >
                      <div className="transition-all duration-300">
                        <FireBadge>
                          x{achievement.streak}{" "}
                          <span className="opacity-100 ml-1">
                            {plan.emoji || "📋"}
                          </span>
                        </FireBadge>
                      </div>

                      {/* New pill for streaks achieved this week */}
                      {isNewThisWeek && achievement.streak > 0 && (
                        <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 bg-white/80 text-gray-800 text-[10px] px-2 py-0.5 rounded-full font-medium shadow-sm whitespace-nowrap">
                          +1 New
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Progress bars section */}
      <div className="flex flex-col gap-0 overflow-visible">
        {plansProgress.map((planProgressData, index) => {
          const { plan, weeks, achievement } = planProgressData;

          // Get current week data
          const currentWeek = weeks.find((week) =>
            isSameWeek(week.startDate, new Date())
          );

          if (!currentWeek) return null;

          // Calculate weekly progress
          const totalPlannedActivities =
            plan.outline_type === "times_per_week"
              ? (currentWeek.plannedActivities as number)
              : (currentWeek.plannedActivities as any[])?.length || 0;

          const uniqueDaysWithActivities = new Set(
            currentWeek.completedActivities.map((entry) =>
              format(new Date(entry.date), "yyyy-MM-dd")
            )
          );

          const totalCompletedActivities = uniqueDaysWithActivities.size;

          // Calculate lifestyle achievement progress
          const lifestyleProgressValue = Math.min(
            ACHIEVEMENT_WEEKS,
            achievement.streak
          );

          const isWeekCompleted = checkIsWeekCompleted(
            currentWeek.startDate,
            plan,
            currentWeek.completedActivities
          );
          const isCurrentWeek = isSameWeek(currentWeek.startDate, new Date());
          const showConfetti = isCurrentWeek && isWeekCompleted;

          const shouldShow = index == 0 || isExpanded;
          const isCoached = index == 0 && userPaidPlanType != "free";

          return (
            <Collapsible open={shouldShow} key={plan.id}>
              <CollapsibleContent className="space-y-0 overflow-visible">
                <div
                  className={`flex flex-col gap-2 p-2 rounded-lg transition-all duration-300 ${
                    (achievement.isAchieved && canDisplayLifestyleAchieved) ||
                    isCoached
                      ? cn(
                          variants.verySoftGrandientBg,
                          variants.ringBright,
                          "ring-2 ring-offset-2 ring-offset-white",
                          "m-1"
                        )
                      : "bg-gray-100/60"
                  } from-gray-50`}
                >
                  <div>
                    <div className="flex items-center gap-2 pr-[5rem]">
                      <span className="text-xl">{plan.emoji || "📋"}</span>
                      <div className="flex flex-col gap-1">
                        <span className="text-md font-semibold text-gray-800">
                          {plan.goal}
                        </span>
                      </div>
                    </div>
                  </div>

                  {isCoached && (
                    <div className="absolute top-0 right-0 opacity-60">
                      <div className="flex items-center gap-1 p-2">
                        <BadgeCheck className={cn("h-4 w-4", variants.text)} />
                        <span className="text-xs font-medium text-gray-500">
                          Coached
                        </span>
                      </div>
                    </div>
                  )}

                  {isCoached && (
                    <>
                      <div className="flex flex-col items-center gap-1 p-2">
                        <MessageBubble direction="left">
                          <div className="flex items-center gap-2">
                            <Avatar>
                              <AvatarImage src="https://alramalhosandbox.s3.eu-west-1.amazonaws.com/tracking_software/picklerick.jpg" />
                              <AvatarFallback>CN</AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col gap-1 flex-1">
                              <span
                                className={`text-sm italic ${
                                  isGeneratingCoachMessage ||
                                  !canGenerateNewMessage
                                    ? "text-gray-400"
                                    : "text-gray-500"
                                }`}
                              >
                                {lastCoachMessage}
                              </span>
                              <span className="text-[10px] italic text-gray-400">
                                Coach Pickle Rick
                              </span>
                            </div>
                            <button
                              onClick={generateCoachMessage}
                              disabled={
                                isGeneratingCoachMessage ||
                                !canGenerateNewMessage
                              }
                              className={cn(
                                "p-1 rounded-full transition-all duration-200",
                                canGenerateNewMessage &&
                                  !isGeneratingCoachMessage
                                  ? "hover:bg-gray-100 text-gray-600 hover:text-gray-800 cursor-pointer"
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
                            <PlanStatus plan={plan} />
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
                      // celebration={
                      //   <span className="flex items-center gap-1">
                      //     🎉
                      //     <span className="text-xs font-normal text-gray-500 animate-pulse">
                      //       Week completed
                      //     </span>
                      //   </span>
                      // }
                    />

                    {/* Lifestyle achievement progress */}
                    <div className="space-y-1">
                      <SteppedBarProgress
                        value={lifestyleProgressValue}
                        maxValue={ACHIEVEMENT_WEEKS}
                        goal={<Medal size={19} className="text-amber-400" />}
                        className={cn("w-full")}
                        onFullyDone={() => {
                          setCanDisplayLifestyleAchieved(true);
                        }}
                        color={variants.bg}
                        celebration={
                          <span className="flex items-center gap-1">
                            <CircleCheck size={19} className="text-green-500" />
                            <span className="text-xs font-normal text-gray-500">
                              Part of your lifestyle!
                            </span>
                          </span>
                        }
                      />
                    </div>

                    {/* Confetti animation for completed weeks */}
                    <AnimatePresence>
                      {showConfetti && (
                        <div className="fixed top-1/2 left-0 w-screen h-screen pointer-events-none z-[101]">
                          <Confetti mode="boom" particleCount={150} />
                        </div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
};
