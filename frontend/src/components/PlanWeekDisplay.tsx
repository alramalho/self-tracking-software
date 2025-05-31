import {
  startOfWeek,
  endOfWeek,
  isSameWeek,
  isAfter,
  isBefore,
} from "date-fns";
import { cn } from "@/lib/utils";
import {
  Activity,
  Plan,
  PlanSession,
  useUserPlan,
} from "@/contexts/UserPlanContext";
import { usePlanProgress } from "@/contexts/PlanProgressContext";
import {
  isWeekCompleted as checkIsWeekCompleted,
  getCompletedOn,
  isSessionCompleted,
} from "@/contexts/PlanProgressContext/lib";
import { useInView } from "react-intersection-observer";
import { SmallActivityEntryCard } from "./SmallActivityEntryCard";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface PlanWeekDisplayProps {
  plan: Plan;
  date: Date;
  className?: string;
}

const MiniActivityCard = ({ activity }: { activity: Activity }) => {
  return (
    <div className="flex flex-col items-center gap-2 p-2 bg-gray-100 rounded-md text-center min-w-16">
      <span className="text-xl">{activity.emoji}</span>
      <span className="text-xs text-gray-700">{activity.title}</span>
    </div>
  );
};

export const PlanWeekDisplay = ({
  plan,
  date,
  className,
}: PlanWeekDisplayProps) => {
  const { plansProgress } = usePlanProgress();
  const { useCurrentUserDataQuery } = useUserPlan();
  const { data: userData } = useCurrentUserDataQuery();
  const planProgress = plansProgress.find((p) => p.plan.id === plan.id);
  const week = planProgress?.weeks.find((w) => isSameWeek(w.startDate, date));

  const [animatedCompletedActivities, setAnimatedCompletedActivities] =
    useState(0);
  const [isFullyDone, setIsFullyDone] = useState(false);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);

  const { ref, inView } = useInView({
    threshold: 0.5,
    triggerOnce: true,
  });

  if (!planProgress || !week) {
    return null;
  }

  const totalPlannedActivities =
    plan.outline_type === "times_per_week"
      ? (week.plannedActivities as number)
      : (week.plannedActivities as PlanSession[]).length;

  const totalCompletedActivities = week.completedActivities?.length || 0;

  const isWeekCompleted = checkIsWeekCompleted(
    week.startDate,
    plan,
    week.completedActivities
  );

  const isCurrentWeek = isSameWeek(week.startDate, new Date());
  const showConfetti = isCurrentWeek && isWeekCompleted;

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
  ]);

  return (
    <div
      ref={ref}
      className={cn(
        "w-full transition-all duration-300 overflow-hidden",
        className
      )}
    >
      <h2 className="text-md font-semibold text-gray-800">
        {plan.goal}
      </h2>

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
        <span className="flex w-full flex-row items-center justify-between text-xs text-gray-700">
          <span>
            <span className="text-lg uppercase">{plan.emoji}</span> ACTIVITIES:
            <span className="font-semibold">
              {" "}
              {totalCompletedActivities}/{totalPlannedActivities}
            </span>
          </span>
          <AnimatePresence>
            {isFullyDone && showConfetti && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ delay: 0.3, duration: 0.4 }}
                className="mt-1 ml-2 text-sm font-normal text-green-600"
              >
                🎉 Week completed!
              </motion.span>
            )}
          </AnimatePresence>
        </span>
      </div>

      {/* coming up section, wherewe either display  */}
      {plan.outline_type == "times_per_week" &&
        isCurrentWeek &&
        !isWeekCompleted && (
          <div className="flex flex-col items-start justify-center gap-0 mt-4">
            <span className="text-sm text-gray-500">Coming up, any of</span>
            <div className="flex flex-nowrap gap-2 overflow-x-auto pb-2 mt-2">
              {week.weekActivities.map((activity) => (
                <MiniActivityCard key={activity.id} activity={activity} />
              ))}
            </div>
          </div>
        )}

      {plan.outline_type == "specific" && isCurrentWeek && !isWeekCompleted && (
        <div className="mt-4 flex flex-col items-start justify-center gap-2">
          <span className="text-sm text-gray-500">Coming up:</span>
          <div className="flex flex-row flex-wrap gap-4">
            {plan.sessions
              .filter((session) => {
                const endOfCurrentWeek = endOfWeek(new Date());
                const beginningOfCurrentWeek = startOfWeek(new Date());
                return (
                  isAfter(session.date, beginningOfCurrentWeek) &&
                  isBefore(session.date, endOfCurrentWeek)
                );
              })
              .map((session) => {
                const activity = userData?.activities.find(
                  (a) => a.id === session.activity_id
                );
                const completed = isSessionCompleted(
                  session,
                  plan,
                  userData?.activityEntries || []
                );
                const completedOn = getCompletedOn(
                  session,
                  plan,
                  userData?.activityEntries || []
                );
                if (!activity) return null;

                const sessionId = `${session.date}-${session.activity_id}`;
                return (
                  <SmallActivityEntryCard
                    key={sessionId}
                    selected={selectedSession === sessionId}
                    entry={{
                      date: session.date,
                      activity_id: session.activity_id,
                      quantity: session.quantity,
                      description: session.descriptive_guide,
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

      {/* <AnimatePresence>
        {isFullyDone && showConfetti && (
          <div className="fixed top-0 left-0 w-screen h-screen pointer-events-none z-[101]">
            <Confetti mode="boom" particleCount={150} />
          </div>
        )}
      </AnimatePresence> */}
    </div>
  );
};
