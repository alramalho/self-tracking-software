import type { Activity } from "@tsw/prisma";
import { createContext } from "react";
import type { CompletePlan } from "../plans";

export interface OnboardingStep {
  id: string;
  component: React.ComponentType;
  next?: string | ((state: OnboardingState) => string | undefined);
  previous?: string | ((state: OnboardingState) => string | undefined);
}

export interface HumanCoachInfo {
  id: string;
  name: string | null;
  username: string;
  picture: string | null;
  title: string;
}

export interface OnboardingContextValue {
  currentStep: string;
  totalSteps: number;
  steps: OnboardingStep[];
  currentStepData: OnboardingStep | null;
  hasNextStep: boolean;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (stepId: string, updates?: object) => void;
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
  wantsCoaching: boolean | null;
  selectedCoachId: string | null; // null = AI coach, string = human coach ID
  selectedCoach: HumanCoachInfo | null; // Full coach info when human coach selected
  setPlanGoal: (goal: string) => void;
  setPlanActivities: (activities: Activity[]) => void;
  setPlanType: (type: string) => void;
  setPlanTimesPerWeek: (times: number) => void;
  setSelectedPlan: (plan: CompletePlan) => void;
  setPartnerType: (type: "human" | null) => void;
  setWantsCoaching: (wants: boolean) => void;
  setSelectedCoachId: (coachId: string | null, coachInfo?: HumanCoachInfo | null) => void;
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
  isPushGranted: boolean;
  wantsCoaching: boolean | null;
  selectedCoachId: string | null; // null = AI coach, string = human coach ID
  selectedCoach: HumanCoachInfo | null; // Full coach info when human coach selected
}
