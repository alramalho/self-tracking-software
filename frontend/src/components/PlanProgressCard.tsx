import React, { useState, useEffect, useMemo } from "react";
import { isSameWeek, format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  ACHIEVEMENT_WEEKS,
  isWeekCompleted as checkIsWeekCompleted,
} from "@/contexts/PlanProgressContext/lib";
import { SteppedBarProgress } from "./SteppedBarProgress";
import {
  Plan,
  Notification,
  useUserPlan,
} from "@/contexts/UserPlanContext";
import { AnimatePresence } from "framer-motion";
import Confetti from "react-confetti-boom";
import { useThemeColors } from "@/hooks/useThemeColors";
import { getThemeVariants } from "@/utils/theme";
import {
  BadgeCheck,
  CircleCheck,
  Flame,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  RefreshCw,
  MoveRight,
} from "lucide-react";
import { Medal } from "lucide-react";
import { Collapsible, CollapsibleContent } from "./ui/collapsible";
import { MessageBubble } from "./MessageBubble";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useApiWithAuth } from "@/api";
import Link from "next/link";
import { motion } from "framer-motion";

export const PlanStatus = ({ plan }: { plan: Plan }) => {
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
  plan: Plan;
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
  const { notificationsData } = useUserPlan();

  const [isAnimationCompleted, setIsAnimationCompleted] = useState<boolean>(false);
  const [lastCoachMessage, setLastCoachMessage] = useState<string | undefined>(
    isDemo ? "Great progress this week! You're building a consistent habit. Keep it up!" : undefined
  );
  const [isGeneratingCoachMessage, setIsGeneratingCoachMessage] = useState(false);
  const api = useApiWithAuth();
  const [lastTimeCoachMessageWasGenerated, setLastTimeCoachMessageWasGenerated] = useLocalStorage<Date | undefined>(
    "last-coach-message-generated-at",
    undefined
  );

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
      notificationsData?.refetch();
    } catch (error) {
      console.error("Failed to generate coach message:", error);
    } finally {
      setIsGeneratingCoachMessage(false);
    }
  };

  // Initialize coach message from notifications data
  useEffect(() => {
    if (!isDemo && notificationsData?.data?.notifications) {
      const initialCoachMessage = notificationsData?.data?.notifications?.find(
        (notification: Notification) => notification.type === "coach"
      )?.message;

      if (initialCoachMessage) {
        setLastCoachMessage(initialCoachMessage);
      }
    }
  }, [notificationsData, isDemo]);

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
    currentWeek.completedActivities.map((entry: any) =>
      format(new Date(entry.date), "yyyy-MM-dd")
    )
  );

  const totalCompletedActivities = uniqueDaysWithActivities.size;

  // Calculate lifestyle achievement progress
  const lifestyleProgressValue = Math.min(ACHIEVEMENT_WEEKS, achievement.streak);

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
                      disabled={isGeneratingCoachMessage || !canGenerateNewMessage}
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
                      <span className="text-xs text-gray-400/80">This week</span>
                      <PlanStatus plan={plan} />
                      {["COMPLETED", "FAILED"].includes(
                        plan?.current_week?.state || ""
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
            />

            {/* Lifestyle achievement progress */}
            <div className="space-y-1">
              <SteppedBarProgress
                value={lifestyleProgressValue}
                maxValue={ACHIEVEMENT_WEEKS}
                goal={<Medal size={19} className="text-amber-400" />}
                className={cn("w-full")}
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