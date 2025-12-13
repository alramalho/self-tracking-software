/* eslint-disable react-refresh/only-export-components */

"use client";

import { useApiWithAuth } from "@/api";
import { BarProgressLoader } from "@/components/ui/bar-progress-loader";
import { Button } from "@/components/ui/button";
import { useActivities } from "@/contexts/activities/useActivities";
import { withFadeUpAnimation } from "@/contexts/onboarding/lib";
import { useOnboarding } from "@/contexts/onboarding/useOnboarding";
import { type CompletePlan, usePlans } from "@/contexts/plans";
import type { Activity } from "@tsw/prisma";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCheck } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

const PlanCard = ({
  plan,
  icon,
  label,
  isSelected,
  onSelect,
  index,
}: {
  plan: CompletePlan;
  icon: React.ReactNode;
  label: React.ReactNode;
  isSelected: boolean;
  onSelect: () => void;
  index: number;
}) => {
  const getWeeksCount = () => {
    if (!plan.finishingDate) return 0;
    const finishDate = new Date(plan.finishingDate);
    const today = new Date();
    const diffTime = Math.abs(finishDate.getTime() - today.getTime());
    const diffWeeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7));
    return diffWeeks;
  };

  const getFrequencyDescription = () => {
    const weeksCount = getWeeksCount();
    if (weeksCount > 0) {
      const sessionsPerWeek = plan.sessions.length / weeksCount;
      const minSessions = Math.floor(sessionsPerWeek);
      const maxSessions = Math.ceil(sessionsPerWeek);
      return minSessions === maxSessions
        ? `${minSessions} times per week`
        : `${minSessions}-${maxSessions} times per week`;
    }
    return "Flexible schedule";
  };

  const weeksCount = getWeeksCount();

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{
        duration: 0.5,
        delay: index * 0.1,
        type: "spring",
        stiffness: 300,
        damping: 25,
      }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onSelect}
      className={`w-full p-6 rounded-3xl border-2 transition-all duration-200 text-left ${
        isSelected
          ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30 shadow-md"
          : "border-border bg-card hover:bg-muted/50"
      }`}
    >
      <div className="flex items-start gap-4">
        <motion.div
          className={`w-12 h-12 rounded-lg flex items-center justify-center ${
            isSelected ? "bg-blue-200 dark:bg-blue-800" : "bg-muted"
          }`}
          animate={isSelected ? { scale: [1, 1.1, 1] } : { scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            className={`text-2xl ${
              isSelected ? "text-blue-900 dark:text-blue-100" : "text-muted-foreground"
            }`}
            animate={isSelected ? { rotate: [0, 10, -10, 0] } : { rotate: 0 }}
            transition={{ duration: 0.5 }}
          >
            {icon}
          </motion.div>
        </motion.div>
        <div className="flex-1">
          <motion.div
            className={`font-semibold text-lg ${
              isSelected ? "text-blue-600 dark:text-blue-400" : "text-foreground"
            }`}
            animate={{ opacity: 1 }}
            initial={{ opacity: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 + 0.2 }}
          >
            {label}
          </motion.div>
          <motion.div
            className={`text-sm mt-1 ${
              isSelected ? "text-blue-700 dark:text-blue-300" : "text-muted-foreground"
            }`}
            animate={{ opacity: 1 }}
            initial={{ opacity: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 + 0.3 }}
          >
            {getFrequencyDescription()}
          </motion.div>
          {weeksCount > 0 && (
            <motion.div
              className={`text-sm mt-1 ${
                isSelected ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"
              }`}
              animate={{ opacity: 1 }}
              initial={{ opacity: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 + 0.4 }}
            >
              {weeksCount} {weeksCount === 1 ? "week" : "weeks"} duration
            </motion.div>
          )}
        </div>
      </div>
    </motion.button>
  );
};

const PlanGenerator = () => {
  const {
    planGoal,
    plans,
    planActivities,
    planProgress,
    selectedPlan,
    wantsCoaching,
    completeStep,
    updateOnboardingState,
    setSelectedPlan,
  } = useOnboarding();
  const { upsertPlan } = usePlans();
  const { upsertActivity } = useActivities();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [generatedPlans, setGeneratedPlans] = useState<CompletePlan[] | null>(
    plans
  );
  const [generatedActivities, setGeneratedActivities] = useState<Activity[]>(
    []
  );
  const api = useApiWithAuth();

  const handlePlanSelect = async (plan: CompletePlan) => {
    setSelectedPlan(plan);
    // Create a Set of activity IDs to avoid duplicates
    const activityIds = new Set(plan.activities.map((activity) => activity.id));

    // Create activities one by one using the unique IDs
    await Promise.all(
      Array.from(activityIds).map((id) => {
        const activity = plan.activities.find((a) => a.id === id);
        if (!activity) return;
        return upsertActivity({
          activity: activity,
          muteNotification: true,
        });
      })
    );
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { progressState, ...planWithoutProgress } = plan;
    upsertPlan({
      planId: plan.id,
      updates: {
        ...planWithoutProgress,
        planGroup: undefined,
        activities: plan.activities,
        sessions: plan.sessions,
        milestones: plan.milestones,
      },
    });
    completeStep("plan-generator", {
      selectedPlan: plan,
      plans: generatedPlans,
    });
  };

  async function generatePlans() {
    try {
      setIsLoading(true);
      const response = await api.post(
        "/onboarding/generate-plans",
        {
          plan_goal: planGoal,
          plan_activities: planActivities,
          plan_progress: planProgress,
          wants_coaching: wantsCoaching,
        },
        {
          timeout: 180000, // 3 minutes in milliseconds
        }
      );

      if (response.data.plans) {
        setGeneratedPlans(response.data.plans);
        if (response.data.activities) {
          setGeneratedActivities(response.data.activities);
        }
        setIsLoading(false);
        updateOnboardingState({
          plans: response.data.plans,
        });
      } else {
        throw new Error("Failed to generate plans. Plan not returned");
      }
    } catch (error) {
      toast.error("Failed to generate plans. Please try again.");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    console.log("plans", plans);
    if (!plans) {
      generatePlans();
      setIsLoading(true);
    } else {
      if (generatedActivities?.length === 0 && planActivities?.length > 0) {
        setGeneratedActivities(planActivities);
      }
    }
  }, [plans, planActivities]);

  return (
    <div className="w-full max-w-md space-y-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex flex-col items-center gap-1">
          <AnimatePresence mode="wait">
            {isLoading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col items-center"
              >
                <motion.div
                  className="relative w-20 h-20"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                >
                  <motion.div
                    className="absolute inset-0 rounded-full bg-blue-100 dark:bg-blue-900/50"
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                  <motion.div
                    className="absolute inset-2 rounded-full bg-blue-200 dark:bg-blue-800/60"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                  />
                  <motion.div
                    className="absolute inset-4 rounded-full bg-blue-400 dark:bg-blue-600"
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                  />
                  <div className="absolute inset-6 rounded-full bg-blue-600 dark:bg-blue-400"></div>
                </motion.div>

                <motion.h2
                  className="text-2xl mt-2 font-bold tracking-tight text-foreground"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                >
                  <motion.span
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    Generating your plan
                  </motion.span>
                </motion.h2>

                <motion.p
                  className="text-muted-foreground mb-6"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.4 }}
                >
                  This may take up to a few minutes.
                </motion.p>

                <BarProgressLoader durationSeconds={90} />
              </motion.div>
            ) : (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{
                  duration: 0.6,
                  type: "spring",
                  stiffness: 300,
                  damping: 25,
                }}
                className="flex flex-col items-center w-full"
              >
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{
                    duration: 0.6,
                    delay: 0.2,
                    type: "spring",
                    stiffness: 400,
                    damping: 15,
                  }}
                >
                  <CheckCheck className="w-20 h-20 mx-auto text-green-600" />
                </motion.div>

                <motion.h2
                  className="text-2xl mt-2 font-bold tracking-tight text-foreground"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                >
                  Your personalized plans are ready!
                </motion.h2>

                <motion.p
                  className="text-muted-foreground mb-6"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.6 }}
                >
                  Choose the plan that fits your schedule:
                </motion.p>

                {generatedPlans && generatedPlans.length > 1 && (
                  <motion.div
                    className="space-y-4 w-full"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.8 }}
                  >
                    <PlanCard
                      plan={generatedPlans[0]}
                      icon={generatedPlans[0].emoji}
                      label="Moderate Plan"
                      isSelected={selectedPlan?.id === generatedPlans[0].id}
                      onSelect={() => handlePlanSelect(generatedPlans[0])}
                      index={0}
                    />
                    <PlanCard
                      plan={generatedPlans[1]}
                      icon="🔥"
                      label="Intense Plan"
                      isSelected={selectedPlan?.id === generatedPlans[1].id}
                      onSelect={() => handlePlanSelect(generatedPlans[1])}
                      index={1}
                    />

                    {import.meta.env.NODE_ENV === "development" && (
                      <Button
                        onClick={() => generatePlans()}
                        className="w-full bg-yellow-400 text-black"
                      >
                        Regenerate Plans
                      </Button>
                    )}
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default withFadeUpAnimation(PlanGenerator);
