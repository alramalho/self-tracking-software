import type { Activity, Plan, PlanSession } from "@tsw/prisma";

export type OnboardingCompletionPlan = Plan & {
  activities: Activity[];
  sessions: Array<PlanSession & { activity: Activity }>;
};

export type OnboardingProgressActivity = {
  id?: string | null;
  title?: string | null;
  emoji?: string | null;
  measure?: string | null;
};

export type OnboardingProgressCoach = {
  id?: string | null;
  name?: string | null;
  username?: string | null;
  title?: string | null;
};

export type OnboardingProgressPlan = {
  id?: string | null;
  goal?: string | null;
  emoji?: string | null;
  goalReason?: string | null;
  outlineType?: string | null;
  timesPerWeek?: number | null;
  estimatedWeeks?: number | null;
  coachId?: string | null;
  activities?: OnboardingProgressActivity[];
  sessionsCount?: number | null;
};

export type OnboardingProgressSnapshot = {
  snapshotVersion?: number;
  currentStep?: string | null;
  currentStepLabel?: string | null;
  currentStepIndex?: number | null;
  totalSteps?: number | null;
  completedSteps?: string[];
  completedStepLabels?: string[];
  selections?: {
    planId?: string | null;
    planGoal?: string | null;
    planGoalReason?: string | null;
    planCoachNotes?: string | null;
    planEmoji?: string | null;
    planType?: string | null;
    planTimesPerWeek?: number | null;
    planProgress?: string | null;
    wantsCoaching?: boolean | null;
    coachPersonality?: string | null;
    selectedCoachId?: string | null;
    selectedCoach?: OnboardingProgressCoach | null;
    partnerType?: string | null;
    isPushGranted?: boolean | null;
    planActivities?: OnboardingProgressActivity[];
    generatedPlans?: OnboardingProgressPlan[];
    selectedPlan?: OnboardingProgressPlan | null;
  };
};
