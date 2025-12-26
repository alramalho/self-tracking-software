import type { Activity, PlanOutlineType, Visibility } from "@tsw/prisma";
import type { PlanMilestone } from "@tsw/prisma/types";
import { createContext } from "react";

export interface GeneratedSession {
  date: Date;
  activityId: string;
  descriptive_guide: string;
  quantity: number;
}

export interface HumanCoachInfo {
  id: string;
  name: string | null;
  username: string;
  picture: string | null;
  title: string;
}

export interface PlanCreationStep {
  id: string;
  component: React.ComponentType;
  next?: string | ((state: PlanCreationState) => string | undefined);
  previous?: string | ((state: PlanCreationState) => string | undefined);
}

export interface PlanCreationState {
  currentStep: string;
  completedSteps: string[];
  // Plan data
  goal: string | null;
  emoji: string | null;
  backgroundImageUrl: string | null;
  backgroundImageFile: File | null;
  isCoached: boolean;
  selectedCoachId: string | null; // null = AI coach, string = human coach ID
  selectedCoach: HumanCoachInfo | null;
  visibility: Visibility;
  finishingDate: Date | null;
  activities: Activity[];
  outlineType: PlanOutlineType;
  timesPerWeek: number | null;
  generatedSessions: GeneratedSession[];
  milestones: PlanMilestone[];
  description: string | null;
  // Edit mode
  editingPlanId: string | null;
  editingSection: string | null; // Which section is being edited in overview mode
}

export interface PlanCreationContextValue {
  // Navigation
  currentStep: string;
  totalSteps: number;
  steps: PlanCreationStep[];
  currentStepData: PlanCreationStep | null;
  hasNextStep: boolean;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (stepId: string, updates?: Partial<PlanCreationState>) => void;
  completeStep: (
    stepId: string,
    updates?: Partial<PlanCreationState>,
    options?: { nextStep?: string; complete?: boolean }
  ) => void;
  isFirstStep: boolean;
  isLastStep: boolean;
  progress: number;
  isStepCompleted: (stepId: string) => boolean;

  // Plan data
  goal: string | null;
  emoji: string | null;
  backgroundImageUrl: string | null;
  backgroundImageFile: File | null;
  isCoached: boolean;
  selectedCoachId: string | null;
  selectedCoach: HumanCoachInfo | null;
  visibility: Visibility;
  finishingDate: Date | null;
  activities: Activity[];
  outlineType: PlanOutlineType;
  timesPerWeek: number | null;
  generatedSessions: GeneratedSession[];
  milestones: PlanMilestone[];
  description: string | null;

  // Edit mode
  editingPlanId: string | null;
  editingSection: string | null;
  isEditMode: boolean;

  // Setters
  setGoal: (goal: string) => void;
  setEmoji: (emoji: string) => void;
  setBackgroundImageUrl: (url: string | null) => void;
  setBackgroundImageFile: (file: File | null) => void;
  setIsCoached: (isCoached: boolean) => void;
  setSelectedCoachId: (coachId: string | null, coachInfo?: HumanCoachInfo | null) => void;
  setVisibility: (visibility: Visibility) => void;
  setFinishingDate: (date: Date | null) => void;
  setActivities: (activities: Activity[]) => void;
  setOutlineType: (type: PlanOutlineType) => void;
  setTimesPerWeek: (times: number | null) => void;
  setGeneratedSessions: (sessions: GeneratedSession[]) => void;
  setMilestones: (milestones: PlanMilestone[]) => void;
  setDescription: (description: string | null) => void;
  setEditingSection: (section: string | null) => void;

  // State management
  updateState: (updates: Partial<PlanCreationState>) => void;
  resetState: () => void;
  initializeForEdit: (planId: string, planData: Partial<PlanCreationState>) => void;
}

export const PlanCreationContext = createContext<PlanCreationContextValue | null>(null);
