import { useActivities } from "@/contexts/activities";
import {
  usePlanProgress,
} from "@/contexts/PlansProgressContext";
import type { PlanProgress as PlanProgressData } from "@/contexts/PlansProgressContext";
import { CompletePlan } from "@/contexts/plans";
import useConfetti from "@/hooks/useConfetti";
import { cn } from "@/lib/utils";
import { Activity, PlanSession } from "@tsw/prisma";
import { endOfWeek, format, isAfter, isSameWeek } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useInView } from "react-intersection-observer";
import { SmallActivityEntryCard } from "./SmallActivityEntryCard";

interface PlanWeekDisplayProps {
  plan: CompletePlan;
  title?: string | React.ReactNode;
  date: Date;
  className?: string;
  planProgress?: PlanProgressData; // Optional plan progress data for demo mode
}

export const MiniActivityCard = ({
  activity,
  className,
}: {
  activity: Activity;
  className?: string;
}) => {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 p-2 bg-gray-100 rounded-md text-center min-w-16",
        className
      )}
    >
      <span className="text-xl">{activity.emoji}</span>
      <span className="text-xs text-gray-700">{activity.title}</span>
    </div>
  );
};

export const PlanWeekDisplay = ({
  plan,
  title,
  date,
  className,
  planProgress: providedPlanProgress,
}: PlanWeekDisplayProps) => {
  // Always call hooks to maintain consistent order
  const { data: planProgressData } = usePlanProgress(plan.id);
  const { activities, activityEntries } = useActivities();
  const { stars, shapes } = useConfetti();

  // Use provided plan progress if available, otherwise use from hook
  const planProgress = providedPlanProgress || planProgressData;
  const week = planProgress?.weeks.find((w) => isSameWeek(w.startDate, date));

  const [animatedCompletedActivities, setAnimatedCompletedActivities] =
    useState(0);
  const [isFullyDone, setIsFullyDone] = useState(false);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);

  const { ref, inView } = useInView({
    threshold: 0.5,
    triggerOnce: true,
  });

  const totalPlannedActivities =
    plan.outlineType === "TIMES_PER_WEEK"
      ? (week?.plannedActivities as number)
      : (week?.plannedActivities as PlanSession[])?.length || 0;

  const uniqueDaysWithActivities = new Set(
    week?.completedActivities.map((entry) =>
      format(new Date(entry.date), "yyyy-MM-dd")
    )
  );

  const totalCompletedActivities = uniqueDaysWithActivities.size;

  const isWeekCompleted = week
    ? (plan.outlineType === "TIMES_PER_WEEK" 
        ? totalCompletedActivities >= totalPlannedActivities
        : totalCompletedActivities === totalPlannedActivities)
    : false;

  const isCurrentWeek = week ? isSameWeek(week.startDate, new Date()) : false;
  const isFutureWeek = week
    ? isAfter(week.startDate, endOfWeek(new Date()))
    : false;
  const showConfetti = isCurrentWeek && isWeekCompleted;

  // // Helper function to check if a streak was achieved this week
  // const wasStreakAchievedThisWeek = (planProgressData: any) => {
  //   const currentWeek = planProgressData.weeks?.find((week: any) =>
  //     isSameWeek(week.startDate, new Date())
  //   );

  //   if (!currentWeek || !currentWeek.completedActivities?.length) {
  //     return false;
  //   }

  //   // Check if this week has completed activities and the streak is > 0
  //   return (
  //     planProgressData.achievement.streak > 0 &&
  //     currentWeek.completedActivities.length > 0
  //   );
  // };

  useEffect(() => {
    if (isFullyDone) {
      stars()
      shapes()
    }
  }, [isFullyDone]);

  useEffect(() => {
    if (inView) {
      const timer = setInterval(() => {
        setAnimatedCompletedActivities((prev) => {
          if (prev < totalCompletedActivities) {
            return prev + 1;
          }
          clearInterval(timer);
          if (prev >= totalPlannedActivities && isWeekCompleted) {
            setIsFullyDone(true);
          }
          return prev;
        });
      }, 300);

      return () => clearInterval(timer);
    }
  }, [
    inView,
    totalCompletedActivities,
    totalPlannedActivities,
    isWeekCompleted,
    plan.id,
  ]);

  // Reset animation when plan changes
  useEffect(() => {
    setAnimatedCompletedActivities(0);
    setIsFullyDone(false);
  }, [plan.id, totalCompletedActivities, totalPlannedActivities]);

  if (!planProgress || !week) {
    return null;
  }

  return (
    <div
      ref={ref}
      className={cn(
        "w-full transition-all duration-300 overflow-hidden",
        className
      )}
    >
      {title &&
        (typeof title === "string" ? (
          <h2 className="text-md font-semibold text-gray-800">{title}</h2>
        ) : (
          title
        ))}

      <div className="flex gap-1 mt-3">
        {Array.from({ length: totalPlannedActivities }, (_, index) => (
          <div
            key={index}
            className={cn(
              "flex-1 h-2 rounded transition-all duration-300",
              index < animatedCompletedActivities
                ? "bg-green-500"
                : "bg-gray-200"
            )}
          />
        ))}
      </div>

      <div className="flex flex-col items-start justify-center gap-0">
        <span className="flex w-full flex-row items-center justify-between text-xs text-gray-700 gap-2">
          <span>
            <span className="text-lg uppercase">{plan.emoji}</span> ACTIVITIES:
            <span className="font-semibold">
              {" "}
              {totalCompletedActivities}/{totalPlannedActivities}
            </span>
          </span>
        </span>
      </div>

      <AnimatePresence>
        {isFullyDone && showConfetti && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: "auto", marginTop: 16 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            transition={{ delay: 0.3, duration: 0.6, ease: "easeOut" }}
            className="overflow-hidden"
            onClick={() => {
              if (Math.random() < 0.5) {
                stars();
              } else {
                shapes();
              }
            }}
          >
            <div className="relative p-3 rounded-lg backdrop-blur-sm bg-gradient-to-br from-green-200/40 via-green-100/40 to-emerald-200/40 border border-green-200 animate-background-position-spin bg-[length:200%_200%]">
              <div className="relative z-10 flex items-center justify-center">
                <span className="text-md font-semibold text-green-700 animate-pulse">
                  🎉 Fantastic work this week!
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* coming up section, wherewe either display  */}
      {plan.outlineType == "TIMES_PER_WEEK" && !isWeekCompleted && (
        <div className="flex flex-col items-start justify-center gap-0 mt-4">
          <span className="text-sm text-gray-500">Coming up, any of:</span>
          <div className="flex flex-nowrap gap-2 overflow-x-auto w-full pb-2 mt-2">
            {week.weekActivities.map((activity) => (
              <MiniActivityCard key={activity.id} activity={activity} />
            ))}
          </div>
        </div>
      )}

      {plan.outlineType == "SPECIFIC" && (isCurrentWeek || isFutureWeek) && (
        <div className="mt-4 flex flex-col items-start justify-center gap-2">
          <span className="text-sm text-gray-500">Coming up:</span>
          <div className="flex flex-row flex-wrap gap-2">
            {plan.sessions
              .filter((session) => {
                return isSameWeek(session.date, date);
              })
              .map((session) => {
                const activity = activities.find(
                  (a) => a.id === session.activityId
                );
                // Check if session is completed by looking for activity entries on that date
                const sessionEntries = (activityEntries || []).filter(entry => 
                  entry.activityId === session.activityId &&
                  isSameWeek(entry.date, session.date)
                );
                const completed = sessionEntries.length > 0;
                const completedOn = sessionEntries[0]?.date;
                if (!activity) return null;

                const sessionId = `${session.date}-${session.activityId}`;
                return (
                  <SmallActivityEntryCard
                    key={sessionId}
                    selected={selectedSession === sessionId}
                    entry={{
                      date: new Date(session.date),
                      activityId: session.activityId,
                      quantity: session.quantity,
                      description: session.descriptiveGuide,
                    }}
                    onClick={(sessionId) => {
                      setSelectedSession(sessionId);
                    }}
                    activity={activity}
                    completed={completed}
                    completedOn={completedOn}
                  />
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
};
