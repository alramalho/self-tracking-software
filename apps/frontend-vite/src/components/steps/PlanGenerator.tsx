/* eslint-disable react-refresh/only-export-components */

"use client";

import { useApiWithAuth } from "@/api";
import { BarProgressLoader } from "@/components/ui/bar-progress-loader";
import { Button } from "@/components/ui/button";
import { OnboardingPlanPreview } from "@/components/OnboardingPlanPreview";
import { useActivities } from "@/contexts/activities/useActivities";
import { withFadeUpAnimation } from "@/contexts/onboarding/lib";
import { useOnboarding } from "@/contexts/onboarding/useOnboarding";
import { type CompletePlan, usePlans } from "@/contexts/plans";
import type { Activity } from "@tsw/prisma";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCheck } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

const getExperienceLabel = (progress: string | null): string => {
  if (!progress) return "a beginner";
  const lower = progress.toLowerCase();
  if (lower.includes("beginner") || lower.includes("never") || lower.includes("new") || lower.includes("starting")) {
    return "a beginner";
  }
  if (lower.includes("some") || lower.includes("little") || lower.includes("occasionally")) {
    return "someone with some experience";
  }
  if (lower.includes("regular") || lower.includes("often") || lower.includes("weekly")) {
    return "an intermediate";
  }
  if (lower.includes("advanced") || lower.includes("years") || lower.includes("experienced")) {
    return "an experienced practitioner";
  }
  return "a beginner";
};

const formatDuration = (weeks: number | null | undefined): string | null => {
  if (!weeks) return null;
  if (weeks <= 4) return `~${weeks} weeks`;
  if (weeks <= 8) return `~${Math.round(weeks / 4)} months`;
  return `~${Math.round(weeks / 4)} months`;
};

const PlanGenerator = () => {
  const {
    planGoal,
    plans,
    planActivities,
    planProgress,
    planTimesPerWeek,
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
          times_per_week: planTimesPerWeek,
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
                  Your plan is ready!
                </motion.h2>

                <motion.p
                  className="text-muted-foreground mb-6"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.6 }}
                >
                  {generatedPlans?.[0]?.estimatedWeeks ? (
                    <>
                      {formatDuration(generatedPlans[0].estimatedWeeks)} program for {getExperienceLabel(planProgress)} at {planTimesPerWeek}x/week.
                      <br />
                      <span className="text-sm">Here's your first two weeks:</span>
                    </>
                  ) : (
                    <>Here's your first two weeks based on {planTimesPerWeek}x per week for {getExperienceLabel(planProgress)}:</>
                  )}
                </motion.p>

                {generatedPlans && generatedPlans.length > 0 && (
                  <motion.div
                    className="space-y-6 w-full"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.8 }}
                  >
                    <OnboardingPlanPreview
                      sessions={generatedPlans[0].sessions}
                      activities={generatedPlans[0].activities || generatedActivities}
                    />

                    <Button
                      onClick={() => handlePlanSelect(generatedPlans[0])}
                      className="w-full"
                      size="lg"
                    >
                      Start my plan
                    </Button>

                    {import.meta.env.DEV && (
                      <Button
                        onClick={() => generatePlans()}
                        variant="outline"
                        className="w-full"
                      >
                        Regenerate Plan
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
