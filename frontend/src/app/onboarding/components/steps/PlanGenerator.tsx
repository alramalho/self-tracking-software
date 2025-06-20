"use client";

import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  CalendarDays,
  CheckCheck,
  CheckCircle,
  CheckIcon,
  Route,
  TrendingUp,
  UserRoundPlus,
} from "lucide-react";
import { useOnboarding } from "../OnboardingContext";
import { useEffect, useState, useRef } from "react";
import { Activity, ApiPlan, useUserPlan } from "@/contexts/UserPlanContext";
import { useApiWithAuth } from "@/api";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";

const PlanCard = ({
  plan,
  icon,
  label,
  isSelected,
  onSelect,
  index,
}: {
  plan: ApiPlan;
  icon: React.ReactNode;
  label: React.ReactNode;
  isSelected: boolean;
  onSelect: () => void;
  index: number;
}) => {
  const getWeeksCount = () => {
    if (!plan.finishing_date) return 0;
    const finishDate = new Date(plan.finishing_date);
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
          ? "border-blue-500 bg-blue-50 shadow-md"
          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
      }`}
    >
      <div className="flex items-start gap-4">
        <motion.div
          className={`w-12 h-12 rounded-lg flex items-center justify-center ${
            isSelected ? "bg-blue-200" : "bg-gray-100"
          }`}
          animate={isSelected ? { scale: [1, 1.1, 1] } : { scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            className={`text-2xl ${
              isSelected ? "text-white" : "text-gray-600"
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
              isSelected ? "text-blue-900" : "text-gray-900"
            }`}
            animate={{ opacity: 1 }}
            initial={{ opacity: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 + 0.2 }}
          >
            {label}
          </motion.div>
          <motion.div
            className={`text-sm mt-1 ${
              isSelected ? "text-blue-700" : "text-gray-600"
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
                isSelected ? "text-blue-600" : "text-gray-500"
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

export const PlanGenerator = () => {
  const {
    planGoal,
    plans,
    planActivities,
    planType,
    planProgress,
    selectedPlan,
    completeStep,
    updateOnboardingState,
    setSelectedPlan,
  } = useOnboarding();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [generatedPlans, setGeneratedPlans] = useState<ApiPlan[] | null>(plans);
  const [generatedActivities, setGeneratedActivities] = useState<Activity[]>(
    []
  );
  const [progress, setProgress] = useState<number>(0);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const api = useApiWithAuth();

  // const createPlan = async (plan: ApiPlan) => {
  //   try {
  //     const response = await api.post("/create-plan", {
  //       ...plan,
  //     });
  //     const createdPlan = response.data.plan;
  //     setSelectedPlan(createdPlan);
  //     refetchUserData();
  //   } catch (error) {
  //     console.error("Plan creation error:", error);
  //     toast.error("Failed to create plan. Please try again.");
  //   }
  // };

  const handlePlanSelect = (plan: ApiPlan) => {
    setSelectedPlan(plan);
    completeStep("plan-generator", {
      selectedPlan: plan,
      plans: generatedPlans,
    });
  };

  const startProgressAnimation = () => {
    const startTime = Date.now();
    const targetProgress = 99;
    const duration = 60000;

    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }

    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const timeRatio = elapsed / duration;

      // Logarithmic progress: fast at start, slows down towards target
      const logarithmicProgress =
        targetProgress * (1 - Math.exp(-timeRatio * 3));

      if (logarithmicProgress >= targetProgress || elapsed >= duration) {
        setProgress(targetProgress);
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
      } else {
        setProgress(Math.floor(logarithmicProgress));
      }
    }, 100); // Update every 100ms
  };

  const stopProgressAnimation = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    setProgress(100);
  };

  async function generatePlans() {
    try {
      setIsLoading(true);
      setProgress(0);
      startProgressAnimation();
      const response = await api.post(
        "/onboarding/generate-plans",
        {
          plan_goal: planGoal,
          plan_activities: planActivities,
          plan_type: planType,
          plan_progress: planProgress,
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
        stopProgressAnimation();
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
      stopProgressAnimation();
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
      if (generatedActivities.length === 0 && planActivities.length > 0) {
        setGeneratedActivities(planActivities);
      }
    }
  }, [plans, planActivities]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

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
                    className="absolute inset-0 rounded-full bg-blue-100"
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                  <motion.div
                    className="absolute inset-2 rounded-full bg-blue-200"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                  />
                  <motion.div
                    className="absolute inset-4 rounded-full bg-blue-400"
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                  />
                  <div className="absolute inset-6 rounded-full bg-blue-600"></div>
                </motion.div>

                <motion.h2
                  className="text-2xl mt-2 font-bold tracking-tight text-gray-900"
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
                  className="text-gray-600 mb-6"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.4 }}
                >
                  This may take up to a few minutes.
                </motion.p>

                <motion.div
                  className="w-full max-w-xs mt-4"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.6 }}
                >
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <motion.div
                      className="bg-blue-600 h-2 rounded-full"
                      initial={{ width: "0%" }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                    />
                  </div>
                </motion.div>
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
                  className="text-2xl mt-2 font-bold tracking-tight text-gray-900"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                >
                  Your personalized plans are ready!
                </motion.h2>

                <motion.p
                  className="text-gray-600 mb-6"
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
