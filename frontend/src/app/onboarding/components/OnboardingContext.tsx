"use client";

import { Activity, ApiPlan } from "@/contexts/UserPlanContext";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import posthog from "posthog-js";
import { usePostHog } from "posthog-js/react";
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";

export interface OnboardingStep {
  id: string;
  component: React.ComponentType;
}

interface OnboardingContextValue {
  currentStep: number;
  totalSteps: number;
  steps: OnboardingStep[];
  currentStepData: OnboardingStep | null;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: number) => void;
  completeStep: (stepId: string, updates: object) => void;
  isFirstStep: boolean;
  isLastStep: boolean;
  progress: number;
  plans: ApiPlan[] | null;
  selectedPlan: ApiPlan | null;
  planGoal: string | null;
  planActivities: Activity[];
  planType: string | null;
  partnerType: "human" | "ai" | null;
  planProgress: string | null;
  setPlanGoal: (goal: string) => void;
  setPlanActivities: (activities: Activity[]) => void;
  setPlanType: (type: string) => void;
  setSelectedPlan: (plan: ApiPlan) => void;
  setPartnerType: (type: "human" | "ai") => void;
  isStepCompleted: (stepId: string) => boolean;
  updateOnboardingState: (updates: object) => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error("useOnboarding must be used within an OnboardingProvider");
  }
  return context;
};

interface OnboardingProviderProps {
  children: React.ReactNode;
  steps: OnboardingStep[];  
  initialStep?: number;
}

export const OnboardingProvider: React.FC<OnboardingProviderProps> = ({
  children,
  steps,
  initialStep = 0,
}) => {
  const [onboardingState, setOnboardingState] = useLocalStorage(
    "onboarding-state",
    {
      currentStep: initialStep,
      completedSteps: [] as string[],
      plans: null as ApiPlan[] | null,
      selectedPlan: null as ApiPlan | null,
      planGoal: null as string | null,
      planActivities: [] as Activity[],
      planProgress: null as string | null,
      planType: null as string | null,
      partnerType: null as "human" | "ai" | null,
    }
  );
  const {
    currentStep,
    completedSteps,
    planGoal,
    planActivities,
    planType,
    planProgress,
    plans,
    partnerType,
    selectedPlan,
  } = onboardingState;

  const setCurrentStep = (step: number) => {
    setOnboardingState({ ...onboardingState, currentStep: step });
  };

  const setCompletedSteps = (steps: string[]) => {
    setOnboardingState({ ...onboardingState, completedSteps: steps });
  };

  const setPlanGoal = (goal: string) => {
    setOnboardingState((prevState) => ({ ...prevState, planGoal: goal }));
  };

  const setPlanActivities = (activities: Activity[]) => {
    setOnboardingState((prevState) => ({
      ...prevState,
      planActivities: activities,
    }));
  };

  const setPlanType = (type: string) => {
    setOnboardingState((prevState) => ({ ...prevState, planType: type }));
  };

  const setSelectedPlan = (plan: ApiPlan) => {
    setOnboardingState((prevState) => ({ ...prevState, selectedPlan: plan }));
  };

  const setPartnerType = (type: "human" | "ai") => {
    setOnboardingState((prevState) => ({ ...prevState, partnerType: type }));
  };

  const posthog = usePostHog();
  const totalSteps = steps.length;

  const currentStepData = steps[currentStep] || null;
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;
  const progress = totalSteps > 0 ? ((currentStep + 1) / totalSteps) * 100 : 0;

  const nextStep = useCallback(() => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    }
  }, [currentStep, totalSteps]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

  const goToStep = useCallback(
    (step: number) => {
      if (step >= 0 && step < totalSteps) {
        setCurrentStep(step);
      }
    },
    [totalSteps]
  );

  const completeStep = useCallback(
    (stepId: string, updates: object = {}) => {
      let newState = onboardingState;
      if (!completedSteps.includes(stepId)) {
        newState = {
          ...onboardingState,
          completedSteps: [...onboardingState.completedSteps, stepId],
        };
      }
      newState = {
        ...newState,
        ...updates,
      };

      if (newState.currentStep < totalSteps) {
        newState.currentStep = newState.currentStep + 1;
      }
      setOnboardingState(newState);
      posthog?.capture(`onboarding-${stepId}-completed`);
    },
    [completedSteps, nextStep, posthog]
  );
  const contextValue: OnboardingContextValue = {
    currentStep,
    totalSteps,
    steps,
    isStepCompleted: (stepId: string) => {
      return completedSteps && Array.from(completedSteps).includes(stepId);
    },
    currentStepData,
    nextStep,
    prevStep,
    goToStep,
    completeStep,
    isFirstStep,
    isLastStep,
    progress,
    plans,
    selectedPlan,
    planGoal,
    partnerType,
    planActivities,
    planType,
    planProgress,
    setPlanGoal,
    setPlanActivities,
    updateOnboardingState: (updates: object) => {
      setOnboardingState({ ...onboardingState, ...updates });
    },
    setPlanType,
    setSelectedPlan,
    setPartnerType,
  };

  return (
    <OnboardingContext.Provider value={contextValue}>
      {children}
    </OnboardingContext.Provider>
  );
};
