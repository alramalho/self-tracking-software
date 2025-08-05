import { useInView } from "react-intersection-observer";
import Confetti from "react-confetti-boom";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { parseISO, startOfWeek, endOfWeek } from "date-fns";
import { Activity, ApiPlan } from "@/contexts/UserGlobalContext";
import { WeeklyCompletionCard } from "./WeeklyCompletionCard";
import { motion, AnimatePresence } from "framer-motion";
import { countTimesPerWeekPlanCompletedWeekSessions } from "@/contexts/PlanProgressContext/lib";

interface WeeklySessionsChecklistProps {
  plan: ApiPlan;
  activityEntries: any[];
}

export function WeeklySessionsChecklist({
  plan,
  activityEntries,
}: WeeklySessionsChecklistProps) {
  const [isFullyDone, setIsFullyDone] = useState(false);
  const [checkedSessions, setCheckedSessions] = useState<number>(0);
  const { ref, inView } = useInView({
    threshold: 0.5,
    triggerOnce: true,
  });
  // Get current week's completed sessions count (unique days)
  const currentWeekStart = startOfWeek(new Date());

  const completedSessionsThisWeek = countTimesPerWeekPlanCompletedWeekSessions(
    plan,
    activityEntries,
    currentWeekStart
  );

  useEffect(() => {
    if (inView) {
      const timer = setInterval(() => {
        setCheckedSessions((prev) => {
          if (prev < completedSessionsThisWeek) {
            return prev + 1;
          }
          clearInterval(timer);
          if (prev >= (plan.timesPerWeek || 0)) {
            setIsFullyDone(true);
          }
          return prev;
        });
      }, 500);

      return () => clearInterval(timer);
    }
  }, [inView, completedSessionsThisWeek, plan.timesPerWeek]);

  // Only show for timesPerWeek plans
  if (plan.outlineType !== "timesPerWeek" || !plan.timesPerWeek) {
    return null;
  }

  return (
    <div ref={ref}>
      <div className="flex flex-row gap-2 items-center justify-center mt-7">
        {Array.from({ length: plan.timesPerWeek }).map((_, index) => (
          <div
            key={index}
            className={cn(
              "w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all duration-300",
              index < checkedSessions
                ? "border-green-500 bg-green-500 scale-100"
                : "border-gray-300 scale-90"
            )}
          >
            {index < checkedSessions && (
              <Check className="w-6 h-6 text-white" />
            )}
          </div>
        ))}
      </div>
      <p className="text-center mt-4 text-sm text-gray-600">
        {completedSessionsThisWeek} of {plan.timesPerWeek} sessions completed
        this week
      </p>
      <AnimatePresence>
        {isFullyDone && (
          <>
            <div className="fixed top-0 left-0 w-screen h-screen pointer-events-none z-[101]">
              <Confetti mode="boom" particleCount={200} />
            </div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ delay: 0.5, duration: 0.5 }}
            >
              <div className="mt-5">
                <WeeklyCompletionCard />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
