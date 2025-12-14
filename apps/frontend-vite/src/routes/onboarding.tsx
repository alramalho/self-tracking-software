import { OnboardingContainer } from "@/components/OnboardingContainer";
import { ProgressBar } from "@/components/ProgressBar";
import CoachingSelector from "@/components/steps/CoachingSelector";
import CoachSelector from "@/components/steps/CoachSelector";
import CommunityPartnerFinder from "@/components/steps/CommunityPartnerFinder";
import PlanActivitySetter from "@/components/steps/PlanActivitySetter";
import PlanGenerator from "@/components/steps/PlanGenerator";
import PlanGoalSetter from "@/components/steps/PlanGoalSetter";
import PlanProgressInitiator from "@/components/steps/PlanProgressInitiator";
import PlanTimesPerWeekSelector from "@/components/steps/PlanTimesPerWeekSelector";
import WelcomeStep from "@/components/steps/WelcomeStep";
import { OnboardingProvider } from "@/contexts/onboarding/provider";
import { type OnboardingStep, type OnboardingState } from "@/contexts/onboarding/types";
import { useOnboarding } from "@/contexts/onboarding/useOnboarding";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, X } from "lucide-react";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
});

/**
 * Defines the onboarding step flow with dynamic navigation based on state.
 * ALL navigation logic is centralized here - components should only call completeStep
 * with state updates, and this function determines the next/previous steps.
 *
 * FLOW:
 * 1. welcome
 * 2. plan-goal-setter - Ask for the goal
 * 3. plan-times-per-week - Ask desired frequency
 * 4. plan-progress-initiator - Ask experience level
 * 5. coaching-selector - AI coaching vs self-guided
 * 6. coach-selector - Choose AI or human coach (only if coaching selected)
 * 7a. If coaching: plan-generator (AI generates activities + adapts frequency)
 * 7b. If self-guided: plan-activity-selector (user picks activities)
 * 8. community-partner-finder - Ask if user wants community accountability partner (merged step)
 */
const getOnboardingSteps = (_state: OnboardingState): OnboardingStep[] => [
  {
    id: "welcome",
    component: WelcomeStep,
  },
  {
    id: "plan-goal-setter",
    component: PlanGoalSetter,
  },
  {
    id: "plan-times-per-week",
    component: PlanTimesPerWeekSelector,
  },
  {
    id: "plan-progress-initiator",
    component: PlanProgressInitiator,
  },
  {
    id: "coaching-selector",
    component: CoachingSelector,
    next: (state) => {
      // AI coaching: go to coach selector to choose AI or human coach
      if (state.wantsCoaching) return "coach-selector";
      // Self-guided: user picks their own activities
      return "plan-activity-selector";
    },
  },
  {
    id: "coach-selector",
    component: CoachSelector,
    next: "plan-generator",
    previous: "coaching-selector",
  },
  {
    id: "plan-activity-selector",
    component: PlanActivitySetter,
    next: "community-partner-finder",
    previous: "coaching-selector",
  },
  {
    id: "plan-generator",
    component: PlanGenerator,
    next: "community-partner-finder",
    previous: "coach-selector",
  },
  {
    id: "community-partner-finder",
    component: CommunityPartnerFinder,
    previous: (state) => {
      // Go back based on coaching choice
      if (state.wantsCoaching) return "plan-generator";
      return "plan-activity-selector";
    },
  },
];

const OnboardingStepRenderer = () => {
  const {
    currentStepData,
    currentStep,
    totalSteps,
    prevStep,
    steps,
  } = useOnboarding();

  const currentStepIndex = steps.findIndex((step) => step.id === currentStep);

  return (
    <OnboardingContainer name={currentStepData?.id || "error"}>
      <ProgressBar
        current={currentStepIndex + 1}
        max={totalSteps}
        className="fixed top-0 left-0 rounded-none"
      />
      <ChevronLeft
        onClick={prevStep}
        className="fixed m-0 top-8 left-2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
      />

      {!currentStepData ? (
        <div className="flex flex-col items-center justify-center h-full">
          <X size={48} className="text-red-500 mb-4" />
          <p className="text-muted-foreground">Error loading step</p>
        </div>
      ) : (
        <currentStepData.component />
      )}
    </OnboardingContainer>
  );
};

// Main onboarding page
function OnboardingPage() {
  // Initialize with empty state - steps will be generated dynamically by the provider
  const initialSteps = getOnboardingSteps({
    currentStep: "welcome",
    completedSteps: [],
    plans: null,
    selectedPlan: null,
    planGoal: null,
    planEmoji: null,
    planActivities: [],
    planProgress: null,
    planType: null,
    planId: "",
    partnerType: null,
    planTimesPerWeek: 3,
    isPushGranted: false,
    wantsCoaching: null,
    selectedCoachId: null,
    selectedCoach: null,
  });

  return (
    <OnboardingProvider steps={initialSteps}>
      <OnboardingStepRenderer />
    </OnboardingProvider>
  );
}
