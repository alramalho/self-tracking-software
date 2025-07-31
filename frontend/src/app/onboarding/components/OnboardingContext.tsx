"use client";

import { Activity, ApiPlan, useUserPlan } from "@/contexts/UserPlanContext";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { usePostHog } from "posthog-js/react";
import React, {
  createContext,
  useContext,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export interface OnboardingStep {
  id: string;
  component: React.ComponentType;
  next?: string;
  previous?: string;
}

interface OnboardingContextValue {
  currentStep: string;
  totalSteps: number;
  steps: OnboardingStep[];
  currentStepData: OnboardingStep | null;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (stepId: string) => void;
  completeStep: (
    stepId: string,
    updates?: object,
    options?: { nextStep?: string; complete?: boolean }
  ) => void;
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
  isOnboardingComplete: boolean;
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
  initialStepId?: string;
}

export const useOnboardingCompleted = () => {
  const [onboardingState] = useLocalStorage("onboarding-state", {
    isComplete: false,
  });
  
  return {
    isOnboardingCompleted: onboardingState.isComplete,
  };
};

export const OnboardingProvider: React.FC<OnboardingProviderProps> = ({
  children,
  steps,
  initialStepId,
}) => {
  const [onboardingState, setOnboardingState] = useLocalStorage(
    "onboarding-state",
    {
      currentStep: initialStepId || steps[0]?.id || "",
      completedSteps: [] as string[],
      plans: null as ApiPlan[] | null,
      selectedPlan: null as ApiPlan | null,
      planGoal: null as string | null,
      planActivities: [] as Activity[],
      planProgress: null as string | null,
      planType: null as string | null,
      partnerType: null as "human" | "ai" | null,
      isComplete: false as boolean,
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
    isComplete,
  } = onboardingState;
  const router = useRouter();
  const setCurrentStep = (stepId: string) => {
    setOnboardingState({ ...onboardingState, currentStep: stepId });
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

  const currentStepIndex = steps.findIndex((step) => step.id === currentStep);
  const currentStepData = steps.find((step) => step.id === currentStep) || null;
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === totalSteps - 1;
  const progress =
    totalSteps > 0 ? ((currentStepIndex + 1) / totalSteps) * 100 : 0;

  const { useCurrentUserDataQuery, isWaitingForData } = useUserPlan();
  const nextStep = useCallback(() => {
    const currentStepData = steps.find((step) => step.id === currentStep);

    // Check if current step has a custom next step defined
    if (currentStepData?.next) {
      setCurrentStep(currentStepData.next);
      return;
    }

    // Default behavior: go to next sequential step
    const currentStepIndex = steps.findIndex((step) => step.id === currentStep);
    if (currentStepIndex < totalSteps - 1 && currentStepIndex !== -1) {
      const nextStepId = steps[currentStepIndex + 1]?.id;
      if (nextStepId) {
        setCurrentStep(nextStepId);
      }
    }
  }, [currentStep, totalSteps, steps]);

  const prevStep = useCallback(() => {
    const currentStepData = steps.find((step) => step.id === currentStep);

    console.log({
      currentStep,
      currentStepData,
    });

    // Check if current step has a custom previous step defined
    if (currentStepData?.previous) {
      setCurrentStep(currentStepData.previous);
      return;
    }

    // Default behavior: go to previous sequential step
    const currentStepIndex = steps.findIndex((step) => step.id === currentStep);
    console.log({
      currentStepIndex,
    });
    if (currentStepIndex > 0 && currentStepIndex !== -1) {
      const prevStepId = steps[currentStepIndex - 1]?.id;
      console.log({
        prevStepId,
      });
      if (prevStepId) {
        setCurrentStep(prevStepId);
      }
    }
  }, [currentStep, steps]);

  const goToStep = useCallback(
    (stepId: string) => {
      const stepExists = steps.some((step) => step.id === stepId);
      if (stepExists) {
        setCurrentStep(stepId);
      }
    },
    [steps]
  );

  const completeStep = useCallback(
    (stepId: string, updates?: object, options?: { nextStep?: string; complete?: boolean }) => {
      let newState = onboardingState;
      if (!completedSteps.includes(stepId)) {
        newState = {
          ...onboardingState,
          completedSteps: [...onboardingState.completedSteps, stepId],
        };
      }
      newState = {
        ...newState,
        ...(updates || {}),
      };

      // Check if this step should mark onboarding as complete
      if (options?.complete) {
        newState.isComplete = true;
        posthog?.capture('onboarding-completed');
        toast.success("Onboarding completed! ");
        router.push("/");
      } else {
        // Priority 1: If options.nextStep is provided, go to that specific step
        if (options?.nextStep) {
          newState.currentStep = options.nextStep;
        } else {
          // Priority 2: Check if the completed step has a custom next step defined
          const completedStepData = steps.find((step) => step.id === stepId);
          if (completedStepData?.next) {
            newState.currentStep = completedStepData.next;
          } else {
            // Priority 3: Default behavior - go to next sequential step
            const currentStepIndex = steps.findIndex(
              (step) => step.id === stepId
            );
            if (currentStepIndex < totalSteps - 1 && currentStepIndex !== -1) {
              const nextStepId = steps[currentStepIndex + 1]?.id;
              if (nextStepId) {
                newState.currentStep = nextStepId;
              }
            }
          }
        }
      }

      setOnboardingState(newState);
      posthog?.capture(`onboarding-${stepId}-completed`);
    },
    [completedSteps, steps, totalSteps, posthog, onboardingState]
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
    isOnboardingComplete: isComplete,
  };

  return (
    <OnboardingContext.Provider value={contextValue}>
      {children}
    </OnboardingContext.Provider>
  );
};
