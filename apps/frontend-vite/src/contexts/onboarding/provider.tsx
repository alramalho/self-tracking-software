"use client";

import { type CompletePlan } from "@/contexts/plans";
import { useCurrentUser } from "@/contexts/users";
import useConfetti from "@/hooks/useConfetti";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useNotifications } from "@/hooks/useNotifications";
import { useNavigate } from "@tanstack/react-router";
import { type Activity } from "@tsw/prisma";
import { usePostHog } from "posthog-js/react";
import React, { useCallback, useEffect, useMemo } from "react";
import toast from "react-hot-toast";
import { v4 as uuidv4 } from "uuid";
import { OnboardingContext, type OnboardingContextValue, type OnboardingState, type OnboardingStep } from "./types";

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
  const { updateUser, refetchCurrentUser } = useCurrentUser();
  const { sideCannons } = useConfetti();
  const { isPushGranted } = useNotifications();
  const [onboardingState, setOnboardingState] = useLocalStorage<OnboardingState>(
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
      planId: uuidv4(),
      partnerType: null as "human" | "ai" | null,
      planTimesPerWeek: 3 as number,
      isPushGranted: false,
      wantsCoaching: null as boolean | null,
    }
  );
  const {
    currentStep,
    completedSteps,
    planGoal,
    planId,
    planEmoji,
    planActivities,
    planType,
    planProgress,
    plans,
    partnerType,
    selectedPlan,
    planTimesPerWeek,
    wantsCoaching,
  } = onboardingState;

  const navigate = useNavigate();

  // Sync isPushGranted from useNotifications hook to onboarding state
  useEffect(() => {
    if (onboardingState.isPushGranted !== isPushGranted) {
      setOnboardingState((prevState) => ({
        ...prevState,
        isPushGranted,
      }));
    }
  }, [isPushGranted]);

  const setCurrentStep = (stepId: string) => {
    setOnboardingState({ ...onboardingState, currentStep: stepId });
  };

  const setPlanGoal = (goal: string) => {
    setOnboardingState((prevState: OnboardingState) => ({ ...prevState, planGoal: goal }));
  };

  const setPlanActivities = (activities: Activity[]) => {
    setOnboardingState((prevState: OnboardingState) => ({
      ...prevState,
      planActivities: activities,
    }));
  };

  const setPlanType = (type: string) => {
    setOnboardingState((prevState: OnboardingState) => ({ ...prevState, planType: type }));
  };

  const setPlanTimesPerWeek = (times: number) => {
    setOnboardingState((prevState: OnboardingState) => ({
      ...prevState,
      planTimesPerWeek: times,
    }));
  };

  const setSelectedPlan = (plan: CompletePlan) => {
    setOnboardingState((prevState: OnboardingState) => ({ ...prevState, selectedPlan: plan }));
  };

  const setPartnerType = (type: "human" | "ai") => {
    setOnboardingState((prevState: OnboardingState) => ({ ...prevState, partnerType: type }));
  };

  const setWantsCoaching = (wants: boolean) => {
    setOnboardingState((prevState: OnboardingState) => ({ ...prevState, wantsCoaching: wants }));
  };

  const posthog = usePostHog();
  const totalSteps = steps.length;

  const currentStepIndex = steps.findIndex((step) => step.id === currentStep);
  const currentStepData = steps.find((step) => step.id === currentStep) || null;
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === totalSteps - 1;
  const progress =
    totalSteps > 0 ? ((currentStepIndex + 1) / totalSteps) * 100 : 0;

  const resolveStepNavigation = useCallback((navigation: string | ((state: OnboardingState) => string | undefined) | undefined): string | undefined => {
    if (typeof navigation === 'function') {
      return navigation(onboardingState);
    }
    return navigation;
  }, [onboardingState]);

  const hasNextStep = useMemo(() => {
    const currentStepData = steps.find((step) => step.id === currentStep);
    const resolvedNext = resolveStepNavigation(currentStepData?.next);
    return (
      resolvedNext != undefined || currentStepIndex < totalSteps - 1
    );
  }, [currentStepIndex, totalSteps, currentStep, steps, resolveStepNavigation]);

  const nextStep = useCallback(() => {
    const currentStepData = steps.find((step) => step.id === currentStep);

    // Check if current step has a custom next step defined
    if (currentStepData?.next) {
      const resolvedNext = resolveStepNavigation(currentStepData.next);
      if (resolvedNext) {
        setCurrentStep(resolvedNext);
        return;
      }
    }

    // Default behavior: go to next sequential step
    const currentStepIndex = steps.findIndex((step) => step.id === currentStep);
    if (currentStepIndex < totalSteps - 1 && currentStepIndex !== -1) {
      const nextStepId = steps[currentStepIndex + 1]?.id;
      if (nextStepId) {
        setCurrentStep(nextStepId);
      }
    }
  }, [currentStep, totalSteps, steps, resolveStepNavigation]);

  const prevStep = useCallback(() => {
    const currentStepData = steps.find((step) => step.id === currentStep);

    console.log({
      currentStep,
      currentStepData,
    });

    // Check if current step has a custom previous step defined
    if (currentStepData?.previous) {
      const resolvedPrevious = resolveStepNavigation(currentStepData.previous);
      if (resolvedPrevious) {
        setCurrentStep(resolvedPrevious);
        return;
      }
    }

    // Default behavior: go to previous sequential step
    const currentStepIndex = steps.findIndex((step) => step.id === currentStep);
    console.log({
      currentStepIndex,
    });
    if (currentStepIndex > 0 && currentStepIndex !== -1) {
      const prevStepId = steps[currentStepIndex - 1]?.id;
      if (prevStepId) {
        setCurrentStep(prevStepId);
      }
    }
  }, [currentStep, steps, resolveStepNavigation]);

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
        })
          .then(() => {
            // Force refetch to ensure the data is truly updated before navigation
            return refetchCurrentUser(false);
          })
          .then(() => {
            posthog.capture("onboarding-completed");
            sideCannons({ duration: 500 });
            toast.success("Onboarding Completed! 🎉");
            navigate({ to: "/" });
          });
      } else {
        // Priority 1: If options.nextStep is provided, go to that specific step
        if (options?.nextStep) {
          newState.currentStep = options.nextStep;
        } else {
          // Priority 2: Check if the completed step has a custom next step defined
          const completedStepData = steps.find((step) => step.id === stepId);
          if (completedStepData?.next) {
            const resolvedNext = typeof completedStepData.next === 'function'
              ? completedStepData.next(newState)
              : completedStepData.next;
            if (resolvedNext) {
              newState.currentStep = resolvedNext;
            }
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
    planId,
    planGoal,
    planEmoji,
    partnerType,
    planActivities,
    planType,
    planProgress,
    planTimesPerWeek,
    wantsCoaching,
    setPlanGoal,
    setPlanActivities,
    updateOnboardingState: (updates: object) => {
      setOnboardingState({ ...onboardingState, ...updates });
    },
    setPlanTimesPerWeek,
    setPlanType,
    setSelectedPlan,
    setPartnerType,
    setWantsCoaching,
  };

  return (
    <OnboardingContext.Provider value={contextValue}>
      {children}
    </OnboardingContext.Provider>
  );
};
