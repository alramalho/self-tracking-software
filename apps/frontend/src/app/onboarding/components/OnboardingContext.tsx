"use client";

import { CompletePlan } from "@/contexts/plans";
import { useCurrentUser } from "@/contexts/users";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { Activity } from "@tsw/prisma";
import { useRouter } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import React, { createContext, useCallback, useContext, useMemo } from "react";
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
  hasNextStep: boolean;
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
  plans: CompletePlan[] | null;
  selectedPlan: CompletePlan | null;
  planGoal: string | null;
  planActivities: Activity[];
  planType: string | null;
  planEmoji: string | null;
  planTimesPerWeek: number;
  partnerType: "human" | "ai" | null;
  planProgress: string | null;
  setPlanGoal: (goal: string) => void;
  setPlanActivities: (activities: Activity[]) => void;
  setPlanType: (type: string) => void;
  setPlanTimesPerWeek: (times: number) => void;
  setSelectedPlan: (plan: CompletePlan) => void;
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
  initialStepId?: string;
}

export const OnboardingProvider: React.FC<OnboardingProviderProps> = ({
  children,
  steps,
  initialStepId,
}) => {
  const { updateUser } = useCurrentUser();
  const [onboardingState, setOnboardingState] = useLocalStorage(
    "onboarding-state",
    {
      currentStep: initialStepId || steps[0]?.id || "",
      completedSteps: [] as string[],
      plans: null as CompletePlan[] | null,
      selectedPlan: null as CompletePlan | null,
      planGoal: null as string | null,
      planEmoji: null as string | null,
      planActivities: [] as Activity[],
      planProgress: null as string | null,
      planType: null as string | null,
      partnerType: null as "human" | "ai" | null,
      planTimesPerWeek: 3 as number,
    }
  );
  const {
    currentStep,
    completedSteps,
    planGoal,
    planEmoji,
    planActivities,
    planType,
    planProgress,
    plans,
    partnerType,
    selectedPlan,
    planTimesPerWeek,
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

  const setPlanTimesPerWeek = (times: number) => {
    setOnboardingState((prevState) => ({
      ...prevState,
      planTimesPerWeek: times,
    }));
  };

  const setSelectedPlan = (plan: CompletePlan) => {
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

  const hasNextStep = useMemo(() => {
    const currentStepData = steps.find((step) => step.id === currentStep);
    return (
      currentStepData?.next != undefined || currentStepIndex < totalSteps - 1
    );
  }, [currentStepIndex, totalSteps]);
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
    (
      stepId: string,
      updates?: object,
      options?: { nextStep?: string; complete?: boolean }
    ) => {
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
        updateUser({
          updates: {
            onboardingCompletedAt: new Date(),
          },
          muteNotifications: true,
        }).then(() => {
          posthog.capture("onboarding-completed");
          toast.success("Onboarding completed! ");
          router.push("/");
        });
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
    hasNextStep,
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
    planEmoji,
    partnerType,
    planActivities,
    planType,
    planProgress,
    planTimesPerWeek,
    setPlanGoal,
    setPlanActivities,
    updateOnboardingState: (updates: object) => {
      setOnboardingState({ ...onboardingState, ...updates });
    },
    setPlanTimesPerWeek,
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
