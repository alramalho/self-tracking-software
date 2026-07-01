import type { Activity } from "@tsw/prisma";
import type { CompletePlan } from "../plans";
import type { OnboardingState, OnboardingStep } from "./types";

type SnapshotActivity = {
  id: string | null;
  title: string | null;
  emoji: string | null;
  measure: string | null;
};

type SnapshotPlan = {
  id: string | null;
  goal: string | null;
  emoji: string | null;
  goalReason: string | null;
  outlineType: string | null;
  timesPerWeek: number | null;
  estimatedWeeks: number | null;
  coachId: string | null;
  activities: SnapshotActivity[];
  sessionsCount: number;
};

const stepLabels: Record<string, string> = {
  welcome: "Welcome",
  "plan-goal-setter": "Goal selection",
  "plan-goal-reason": "Goal reason",
  "plan-times-per-week": "Frequency",
  "plan-progress-initiator": "Starting level",
  "coaching-selector": "Coaching mode",
  "coach-selector": "Coach selection",
  "plan-activity-selector": "Activity selection",
  "plan-generator": "Plan generation",
  "community-partner-finder": "Accountability partner",
};

function formatStepLabel(stepId: string) {
  return (
    stepLabels[stepId] ||
    stepId
      .split("-")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

function snapshotActivity(activity: Activity): SnapshotActivity {
  return {
    id: activity.id ?? null,
    title: activity.title ?? null,
    emoji: activity.emoji ?? null,
    measure: activity.measure ?? null,
  };
}

function snapshotPlan(plan: CompletePlan | null): SnapshotPlan | null {
  if (!plan) return null;

  return {
    id: plan.id ?? null,
    goal: plan.goal ?? null,
    emoji: plan.emoji ?? null,
    goalReason: plan.goalReason ?? null,
    outlineType: plan.outlineType ?? null,
    timesPerWeek: plan.timesPerWeek ?? null,
    estimatedWeeks: plan.estimatedWeeks ?? null,
    coachId: plan.coachId ?? null,
    activities: (plan.activities || []).map(snapshotActivity),
    sessionsCount: plan.sessions?.length || 0,
  };
}

export function buildOnboardingProgressSnapshot(
  state: OnboardingState,
  steps: OnboardingStep[]
) {
  const currentStepIndex = steps.findIndex((step) => step.id === state.currentStep);

  return {
    snapshotVersion: 1,
    currentStep: state.currentStep,
    currentStepLabel: formatStepLabel(state.currentStep),
    currentStepIndex: currentStepIndex >= 0 ? currentStepIndex + 1 : null,
    totalSteps: steps.length,
    completedSteps: state.completedSteps,
    completedStepLabels: state.completedSteps.map(formatStepLabel),
    selections: {
      planId: state.planId || null,
      planGoal: state.planGoal,
      planGoalReason: state.planGoalReason,
      planCoachNotes: state.planCoachNotes || null,
      planEmoji: state.planEmoji,
      planType: state.planType,
      planTimesPerWeek: state.planTimesPerWeek,
      planProgress: state.planProgress,
      wantsCoaching: state.wantsCoaching,
      coachPersonality: state.coachPersonality,
      selectedCoachId: state.selectedCoachId,
      selectedCoach: state.selectedCoach
        ? {
            id: state.selectedCoach.id,
            name: state.selectedCoach.name,
            username: state.selectedCoach.username,
            title: state.selectedCoach.title,
          }
        : null,
      partnerType: state.partnerType,
      isPushGranted: state.isPushGranted,
      planActivities: state.planActivities.map(snapshotActivity),
      generatedPlans: (state.plans || [])
        .map((plan) => snapshotPlan(plan))
        .filter((plan): plan is SnapshotPlan => Boolean(plan)),
      selectedPlan: snapshotPlan(state.selectedPlan),
    },
  };
}
