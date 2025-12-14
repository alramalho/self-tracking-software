import { useActivities } from "@/contexts/activities/useActivities";
import { type CompletePlan } from "@/contexts/plans";
import useConfetti from "@/hooks/useConfetti";
import { useThemeColors } from "@/hooks/useThemeColors";
import { cn } from "@/lib/utils";
import { getThemeVariants } from "@/utils/theme";
import { type Activity, type PlanSession } from "@tsw/prisma";
import { endOfWeek, format, isAfter, isSameWeek } from "date-fns";
import { AnimatePresence } from "framer-motion";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { useInView } from "react-intersection-observer";
import { SmallActivityEntryCard } from "./SmallActivityEntryCard";
import { X } from "lucide-react";

interface PlanWeekDisplayProps {
  plan: CompletePlan;
  title?: string | React.ReactNode;
  date: Date;
  className?: string;
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
        "flex flex-col items-center gap-2 p-2 bg-muted rounded-md text-center min-w-16",
        className
      )}
    >
      <span className="text-xl">{activity.emoji}</span>
      <span className="text-xs text-foreground">{activity.title}</span>
    </div>
  );
};

export const PlanWeekDisplay = ({
  plan,
  title,
  date,
  className,
}: PlanWeekDisplayProps) => {
  // Always call hooks to maintain consistent order
  const { activities, activityEntries } = useActivities();
  const { stars, shapes } = useConfetti();
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);

  // Use provided plan progress if available, otherwise use from hook
  const week = plan.progress?.weeks.find((w) => isSameWeek(w.startDate, date));

  const [animatedCompletedActivities, setAnimatedCompletedActivities] =
    useState(0);
  const [isFullyDone, setIsFullyDone] = useState(false);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  const { ref, inView } = useInView({
    threshold: 0.5,
    triggerOnce: true,
  });

  const totalPlannedActivities =
    plan.outlineType === "TIMES_PER_WEEK"
      ? (week?.plannedActivities as number)
      : (week?.plannedActivities as PlanSession[])?.length || 0;

  // Use live activityEntries data instead of cached plan.progress.weeks.completedActivities
  // This ensures the UI updates immediately when activities are added/deleted
  const planActivityIds = plan.activities?.map((a) => a.id) || [];
  const liveCompletedActivities = activityEntries.filter(
    (entry) => entry.activityId &&
      planActivityIds.includes(entry.activityId) &&
      isSameWeek(new Date(entry.datetime), date)
  );

  const uniqueDaysWithActivities = new Set(
    liveCompletedActivities.map((entry) =>
      format(new Date(entry.datetime), "yyyy-MM-dd")
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

  if (!plan.progress || !week) {
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
          <h2 className="text-md font-semibold text-foreground">{title}</h2>
        ) : (
          title
        ))}

      {/* Week completed badge */}
      {isWeekCompleted && (
        <div className="flex items-center gap-2 flex-wrap mt-2">
          <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/30 w-fit">
            <span className="text-[12px] font-medium text-green-500">
              Week completed
            </span>
          </div>
        </div>
      )}

      <div className="flex gap-1 mt-3">
        {Array.from({ length: totalPlannedActivities }, (_, index) => (
          <div
            key={index}
            className={cn(
              "flex-1 h-2 rounded transition-all duration-300",
              index < animatedCompletedActivities
                ? "bg-green-500"
                : "bg-muted"
            )}
          />
        ))}
      </div>

      <div className="flex flex-col items-start justify-center gap-0">
        <span className="flex w-full flex-row items-center justify-between text-xs text-muted-foreground gap-2">
          <span>
            <span className="text-lg uppercase">{plan.emoji}</span> ACTIVITIES:
            <span className="font-semibold">
              {" "}
              {totalCompletedActivities}/{totalPlannedActivities}
            </span>
          </span>
        </span>
      </div>


      {/* coming up section, wherewe either display  */}
      {plan.outlineType == "TIMES_PER_WEEK" && !isWeekCompleted && (
        <div className="flex flex-col items-start justify-center gap-0 mt-4">
          <span className="text-sm text-muted-foreground">Coming up, any of:</span>
          <div className="flex flex-nowrap gap-2 overflow-x-auto w-full pb-2 mt-2">
            {week.weekActivities.map((activity) => (
              <MiniActivityCard key={activity.id} activity={activity} />
            ))}
          </div>
        </div>
      )}

      {plan.outlineType == "SPECIFIC" && (isCurrentWeek || isFutureWeek) && (
        <div className="mt-4 flex flex-col items-start justify-center gap-2">
          <span className="text-sm text-muted-foreground">Coming up:</span>
          <div className="flex flex-row flex-wrap gap-2 p-1">
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
                  isSameWeek(entry.datetime, session.date)
                );
                const completed = sessionEntries.length > 0;
                const completedOn = sessionEntries[0]?.datetime;
                if (!activity) return null;

                const sessionId = `${session.date}-${session.activityId}`;
                return (
                  <SmallActivityEntryCard
                    key={sessionId}
                    selected={selectedSession === sessionId}
                    entry={{
                      datetime: new Date(session.date),
                      activityId: session.activityId,
                      quantity: session.quantity,
                      description: session.descriptiveGuide,
                      imageUrls: session.imageUrls,
                    }}
                    onClick={(sessionId) => {
                      setSelectedSession(prev => prev === sessionId ? null : sessionId);
                    }}
                    activity={activity}
                    completed={completed}
                    completedOn={completedOn}
                  />
                );
              })}
          </div>

          {/* Selected session detail panel */}
          <AnimatePresence mode="wait">
            {selectedSession && (() => {
              const selectedSessionData = plan.sessions.find(
                (s) => `${s.date}-${s.activityId}` === selectedSession
              );
              const selectedActivity = selectedSessionData
                ? activities.find((a) => a.id === selectedSessionData.activityId)
                : null;

              if (!selectedSessionData || !selectedActivity) return null;

              return (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={cn("w-full p-4 rounded-xl border", variants.brightBorder, variants.veryFadedBg)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{selectedActivity.emoji || "📋"}</span>
                      <div>
                        <h4 className="text-left font-semibold text-foreground">
                          {selectedActivity.title}
                        </h4>
                        <p className="text-left text-sm text-muted-foreground">
                          {format(new Date(selectedSessionData.date), "EEEE, MMM d")} •{" "}
                          {selectedSessionData.quantity} {selectedActivity.measure}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedSession(null)}
                      className="p-1 rounded-md hover:bg-muted transition-colors"
                    >
                      <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>

                  {selectedSessionData.descriptiveGuide && (
                    <p className="mt-3 text-sm text-foreground text-left">
                      {selectedSessionData.descriptiveGuide}
                    </p>
                  )}

                  {selectedSessionData.imageUrls && selectedSessionData.imageUrls.length > 0 && (
                    <div className="mt-3 flex gap-2 overflow-x-auto">
                      {selectedSessionData.imageUrls.map((url, idx) => (
                        <button
                          key={idx}
                          onClick={() => setExpandedImage(url)}
                          className={cn("flex-shrink-0 rounded-lg overflow-hidden hover:ring-2 transition-all", variants.ring)}
                        >
                          <img
                            src={url}
                            alt={`Session reference ${idx + 1}`}
                            className="h-24 w-auto object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </motion.div>
              );
            })()}
          </AnimatePresence>
        </div>
      )}

      {/* Full-screen image dialog */}
      <AnimatePresence>
        {expandedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            onClick={() => setExpandedImage(null)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="relative max-w-full max-h-full"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setExpandedImage(null)}
                className="absolute -top-10 right-0 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              >
                <X className="w-6 h-6 text-white" />
              </button>
              <img
                src={expandedImage}
                alt="Session reference expanded"
                className="max-w-full max-h-[80vh] rounded-xl object-contain"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
