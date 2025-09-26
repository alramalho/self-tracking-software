import type { Activity } from "@tsw/prisma";
import { createContext } from "react";
import type { CompletePlan } from "../plans";

export interface OnboardingStep {
  id: string;
  component: React.ComponentType;
  next?: string;
  previous?: string;
}

export interface OnboardingContextValue {
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
  planId: string;
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

export const OnboardingContext = createContext<OnboardingContextValue | null>(
  null
);

export interface OnboardingState {
  currentStep: string;
  completedSteps: string[];
  plans: CompletePlan[] | null;
  selectedPlan: CompletePlan | null;
  planGoal: string | null;
  planEmoji: string | null;
  planActivities: Activity[];
  planProgress: string | null;
  planType: string | null;
  planId: string;
  partnerType: "human" | "ai" | null;
  planTimesPerWeek: number;
}
