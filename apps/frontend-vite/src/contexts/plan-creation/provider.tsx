"use client";

import { useLocalStorage } from "@/hooks/useLocalStorage";
import type { Activity, PlanOutlineType, Visibility } from "@tsw/prisma";
import type { PlanMilestone } from "@tsw/prisma/types";
import { usePostHog } from "posthog-js/react";
import React, { useCallback, useMemo } from "react";
import {
  PlanCreationContext,
  type PlanCreationContextValue,
  type PlanCreationState,
  type PlanCreationStep,
  type GeneratedSession,
  type HumanCoachInfo,
} from "./types";

interface PlanCreationProviderProps {
  children: React.ReactNode;
  steps: PlanCreationStep[];
  initialStepId?: string;
}

const getDefaultState = (initialStepId?: string, steps?: PlanCreationStep[]): PlanCreationState => ({
  currentStep: initialStepId || steps?.[0]?.id || "goal",
  completedSteps: [],
  goal: null,
  emoji: null,
  backgroundImageUrl: null,
  backgroundImageFile: null,
  isCoached: false,
  selectedCoachId: null,
  selectedCoach: null,
  visibility: "PUBLIC" as Visibility,
  finishingDate: null,
  activities: [],
  outlineType: "TIMES_PER_WEEK" as PlanOutlineType, // Default to self-guided
  timesPerWeek: 3, // Default to 3 times per week
  generatedSessions: [],
  milestones: [],
  description: null,
  editingPlanId: null,
  editingSection: null,
  originalValues: null,
});

export const PlanCreationProvider: React.FC<PlanCreationProviderProps> = ({
  children,
  steps,
  initialStepId,
}) => {
  const posthog = usePostHog();

  const [state, setState] = useLocalStorage<PlanCreationState>(
    "plan-creation-state",
    getDefaultState(initialStepId, steps)
  );

  const {
    currentStep,
    completedSteps,
    goal,
    emoji,
    backgroundImageUrl,
    backgroundImageFile,
    isCoached,
    selectedCoachId,
    selectedCoach,
    visibility,
    finishingDate,
    activities,
    outlineType,
    timesPerWeek,
    generatedSessions,
    milestones,
    description,
    editingPlanId,
    editingSection,
    originalValues,
  } = state;

  const totalSteps = steps.length;
  const currentStepIndex = steps.findIndex((step) => step.id === currentStep);
  const currentStepData = steps.find((step) => step.id === currentStep) || null;
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === totalSteps - 1;
  const progress = totalSteps > 0 ? ((currentStepIndex + 1) / totalSteps) * 100 : 0;
  const isEditMode = editingPlanId !== null;

  const resolveStepNavigation = useCallback(
    (navigation: string | ((state: PlanCreationState) => string | undefined) | undefined): string | undefined => {
      if (typeof navigation === "function") {
        return navigation(state);
      }
      return navigation;
    },
    [state]
  );

  const hasNextStep = useMemo(() => {
    const stepData = steps.find((step) => step.id === currentStep);
    const resolvedNext = resolveStepNavigation(stepData?.next);
    return resolvedNext !== undefined || currentStepIndex < totalSteps - 1;
  }, [currentStepIndex, totalSteps, currentStep, steps, resolveStepNavigation]);

  // Navigation methods
  const setCurrentStep = useCallback((stepId: string) => {
    setState((prev) => ({ ...prev, currentStep: stepId }));
  }, [setState]);

  const nextStep = useCallback(() => {
    const stepData = steps.find((step) => step.id === currentStep);

    if (stepData?.next) {
      const resolvedNext = resolveStepNavigation(stepData.next);
      if (resolvedNext) {
        setCurrentStep(resolvedNext);
        return;
      }
    }

    const idx = steps.findIndex((step) => step.id === currentStep);
    if (idx < totalSteps - 1 && idx !== -1) {
      const nextStepId = steps[idx + 1]?.id;
      if (nextStepId) {
        setCurrentStep(nextStepId);
      }
    }
  }, [currentStep, totalSteps, steps, resolveStepNavigation, setCurrentStep]);

  const prevStep = useCallback(() => {
    const stepData = steps.find((step) => step.id === currentStep);

    if (stepData?.previous) {
      const resolvedPrevious = resolveStepNavigation(stepData.previous);
      if (resolvedPrevious) {
        setCurrentStep(resolvedPrevious);
        return;
      }
    }

    const idx = steps.findIndex((step) => step.id === currentStep);
    if (idx > 0 && idx !== -1) {
      const prevStepId = steps[idx - 1]?.id;
      if (prevStepId) {
        setCurrentStep(prevStepId);
      }
    }
  }, [currentStep, steps, resolveStepNavigation, setCurrentStep]);

  const goToStep = useCallback(
    (stepId: string, updates?: Partial<PlanCreationState>) => {
      const stepExists = steps.some((step) => step.id === stepId);
      if (stepExists) {
        setState((prev) => ({
          ...prev,
          ...(updates || {}),
          currentStep: stepId,
        }));
      }
    },
    [steps, setState]
  );

  const completeStep = useCallback(
    (
      stepId: string,
      updates?: Partial<PlanCreationState>,
      options?: { nextStep?: string; complete?: boolean }
    ) => {
      setState((prev) => {
        let newState = { ...prev };

        // Add to completed steps if not already there
        if (!prev.completedSteps.includes(stepId)) {
          newState.completedSteps = [...prev.completedSteps, stepId];
        }

        // Apply updates
        newState = {
          ...newState,
          ...(updates || {}),
        };

        // Determine next step
        if (options?.nextStep) {
          newState.currentStep = options.nextStep;
        } else if (!options?.complete) {
          const stepData = steps.find((step) => step.id === stepId);
          if (stepData?.next) {
            const resolvedNext =
              typeof stepData.next === "function"
                ? stepData.next(newState)
                : stepData.next;
            if (resolvedNext) {
              newState.currentStep = resolvedNext;
            }
          } else {
            const idx = steps.findIndex((step) => step.id === stepId);
            if (idx < totalSteps - 1 && idx !== -1) {
              const nextStepId = steps[idx + 1]?.id;
              if (nextStepId) {
                newState.currentStep = nextStepId;
              }
            }
          }
        }

        return newState;
      });

      posthog?.capture(`plan-creation-${stepId}-completed`);
    },
    [steps, totalSteps, posthog, setState]
  );

  const isStepCompleted = useCallback(
    (stepId: string) => completedSteps?.includes(stepId) ?? false,
    [completedSteps]
  );

  // Setters
  const setGoal = useCallback((goal: string) => {
    setState((prev) => ({ ...prev, goal }));
  }, [setState]);

  const setEmoji = useCallback((emoji: string) => {
    setState((prev) => ({ ...prev, emoji }));
  }, [setState]);

  const setBackgroundImageUrl = useCallback((url: string | null) => {
    setState((prev) => ({ ...prev, backgroundImageUrl: url }));
  }, [setState]);

  const setBackgroundImageFile = useCallback((file: File | null) => {
    setState((prev) => ({ ...prev, backgroundImageFile: file }));
  }, [setState]);

  const setIsCoached = useCallback((isCoached: boolean) => {
    setState((prev) => ({ ...prev, isCoached }));
  }, [setState]);

  const setSelectedCoachId = useCallback(
    (coachId: string | null, coachInfo?: HumanCoachInfo | null) => {
      setState((prev) => ({
        ...prev,
        selectedCoachId: coachId,
        selectedCoach: coachInfo || null,
      }));
    },
    [setState]
  );

  const setVisibility = useCallback((visibility: Visibility) => {
    setState((prev) => ({ ...prev, visibility }));
  }, [setState]);

  const setFinishingDate = useCallback((date: Date | null) => {
    setState((prev) => ({ ...prev, finishingDate: date }));
  }, [setState]);

  const setActivities = useCallback((activities: Activity[]) => {
    setState((prev) => ({ ...prev, activities }));
  }, [setState]);

  const setOutlineType = useCallback((type: PlanOutlineType) => {
    setState((prev) => ({ ...prev, outlineType: type }));
  }, [setState]);

  const setTimesPerWeek = useCallback((times: number | null) => {
    setState((prev) => ({ ...prev, timesPerWeek: times }));
  }, [setState]);

  const setGeneratedSessions = useCallback((sessions: GeneratedSession[]) => {
    setState((prev) => ({ ...prev, generatedSessions: sessions }));
  }, [setState]);

  const setMilestones = useCallback((milestones: PlanMilestone[]) => {
    setState((prev) => ({ ...prev, milestones }));
  }, [setState]);

  const setDescription = useCallback((description: string | null) => {
    setState((prev) => ({ ...prev, description }));
  }, [setState]);

  const setEditingSection = useCallback((section: string | null) => {
    setState((prev) => ({ ...prev, editingSection: section }));
  }, [setState]);

  // State management
  const updateState = useCallback((updates: Partial<PlanCreationState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, [setState]);

  const resetState = useCallback(() => {
    setState(getDefaultState(initialStepId, steps));
  }, [setState, initialStepId, steps]);

  const initializeForEdit = useCallback(
    (planId: string, planData: Partial<PlanCreationState>) => {
      // Store original values for change tracking
      const originalValues = {
        goal: planData.goal ?? null,
        emoji: planData.emoji ?? null,
        backgroundImageUrl: planData.backgroundImageUrl ?? null,
        isCoached: planData.isCoached ?? false,
        selectedCoachId: planData.selectedCoachId ?? null,
        visibility: planData.visibility ?? "PUBLIC",
        finishingDate: planData.finishingDate ?? null,
        activities: planData.activities ?? [],
        timesPerWeek: planData.timesPerWeek ?? null,
        milestones: planData.milestones ?? [],
      };

      setState((prev) => ({
        ...getDefaultState(initialStepId, steps),
        ...planData,
        editingPlanId: planId,
        currentStep: "overview", // For edit mode, start with overview
        originalValues,
      }));
    },
    [setState, initialStepId, steps]
  );

  const contextValue: PlanCreationContextValue = {
    // Navigation
    currentStep,
    totalSteps,
    steps,
    currentStepData,
    hasNextStep,
    nextStep,
    prevStep,
    goToStep,
    completeStep,
    isFirstStep,
    isLastStep,
    progress,
    isStepCompleted,

    // Plan data
    goal,
    emoji,
    backgroundImageUrl,
    backgroundImageFile,
    isCoached,
    selectedCoachId,
    selectedCoach,
    visibility,
    finishingDate,
    activities,
    outlineType,
    timesPerWeek,
    generatedSessions,
    milestones,
    description,

    // Edit mode
    editingPlanId,
    editingSection,
    isEditMode,
    originalValues,

    // Setters
    setGoal,
    setEmoji,
    setBackgroundImageUrl,
    setBackgroundImageFile,
    setIsCoached,
    setSelectedCoachId,
    setVisibility,
    setFinishingDate,
    setActivities,
    setOutlineType,
    setTimesPerWeek,
    setGeneratedSessions,
    setMilestones,
    setDescription,
    setEditingSection,

    // State management
    updateState,
    resetState,
    initializeForEdit,
  };

  return (
    <PlanCreationContext.Provider value={contextValue}>
      {children}
    </PlanCreationContext.Provider>
  );
};
