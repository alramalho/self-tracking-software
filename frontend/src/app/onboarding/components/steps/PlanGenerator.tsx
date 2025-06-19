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
import { NextButton } from "../../page";
import { Textarea } from "@/components/ui/textarea";
import { TextAreaWithVoice } from "@/components/ui/TextAreaWithVoice";
import { useEffect, useState, useRef } from "react";
import { Activity, ApiPlan } from "@/contexts/UserPlanContext";
import { ActivityCard } from "@/components/ActivityCard";
import ActivityItem from "@/components/plan-configuration/ActivityItem";
import { useApiWithAuth } from "@/api";
import toast from "react-hot-toast";

const PlanCard = ({
  plan,
  icon,
  label,
  isSelected,
  onSelect,
}: {
  plan: ApiPlan;
  icon: React.ReactNode;
  label: React.ReactNode;
  isSelected: boolean;
  onSelect: () => void;
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
    <button
      onClick={onSelect}
      className={`w-full p-6 rounded-3xl border-2 transition-all duration-200 text-left ${
        isSelected
          ? "border-blue-500 bg-blue-50 shadow-md"
          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
      }`}
    >
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
          isSelected ? "bg-blue-200" : "bg-gray-100"
        }`}>
          <div className={`text-2xl ${isSelected ? "text-white" : "text-gray-600"}`}>
            {icon}
          </div>
        </div>
        <div className="flex-1">
          <div className={`font-semibold text-lg ${
            isSelected ? "text-blue-900" : "text-gray-900"
          }`}>
            {label}
          </div>
          <div className={`text-sm mt-1 ${
            isSelected ? "text-blue-700" : "text-gray-600"
          }`}>
            {getFrequencyDescription()}
          </div>
          {weeksCount > 0 && (
            <div className={`text-sm mt-1 ${
              isSelected ? "text-blue-600" : "text-gray-500"
            }`}>
              {weeksCount} {weeksCount === 1 ? "week" : "weeks"} duration
            </div>
          )}
        </div>
      </div>
    </button>
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
      const logarithmicProgress = targetProgress * (1 - Math.exp(-timeRatio * 3));
      
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
      
      const response = await api.post("/onboarding/generate-plans", {
        plan_goal: planGoal,
        plan_activities: planActivities,
        plan_type: planType,
        plan_progress: planProgress,
      });

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
        throw new Error("Failed to generate plan. Plan not returned");
      }
    } catch (error) {
      toast.error("Failed to generate plan. Please try again.");
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
          {isLoading ? (
            <>
              <div className="relative w-20 h-20">
                <div className="absolute inset-0 rounded-full bg-blue-100 animate-pulse"></div>
                <div className="absolute inset-2 rounded-full bg-blue-200 animate-ping"></div>
                <div className="absolute inset-4 rounded-full bg-blue-400 animate-pulse"></div>
                <div className="absolute inset-6 rounded-full bg-blue-600"></div>
              </div>
              <h2 className="text-2xl mt-2 font-bold tracking-tight text-gray-900 animate-pulse">
                <span>Generating your plan</span>
              </h2>
              <p className="text-gray-600 mb-6">
                This may take up to 1 minute.
              </p>
              <div className="w-full max-w-xs mt-4">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
            </>
          ) : (
            <>
              <CheckCheck className="w-20 h-20 mx-auto text-green-600" />
              <h2 className="text-2xl mt-2 font-bold tracking-tight text-gray-900">
                Your personalized plans are ready!
              </h2>
              <p className="text-gray-600 mb-6">
                Choose the plan that fits your schedule:
              </p>

              {generatedPlans && generatedPlans.length > 1 && (
                <div className="space-y-4 w-full">
                  <PlanCard
                    plan={generatedPlans[0]}
                    icon={generatedPlans[0].emoji}
                    label="Moderate Plan"
                    isSelected={selectedPlan?.id === generatedPlans[0].id}
                    onSelect={() => handlePlanSelect(generatedPlans[0])}
                  />
                  <PlanCard
                    plan={generatedPlans[1]}
                    icon="🔥"
                    label="Intense Plan"
                    isSelected={selectedPlan?.id === generatedPlans[1].id}
                    onSelect={() => handlePlanSelect(generatedPlans[1])}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
