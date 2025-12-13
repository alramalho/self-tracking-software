import { OnboardingContainer } from "@/components/OnboardingContainer";
import { ProgressBar } from "@/components/ProgressBar";
import AIPartnerFinder from "@/components/steps/AIPartnerFinder";
import CoachingSelector from "@/components/steps/CoachingSelector";
import HumanPartnerFinder from "@/components/steps/HumanPartnerFinder";
import NotificationsSelector from "@/components/steps/NotificationsSelector";
import PartnerTypeSelector from "@/components/steps/PartnerSelector";
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
 * NEW FLOW:
 * 1. welcome
 * 2. plan-goal-setter - Ask for the goal
 * 3. plan-times-per-week - Ask desired frequency
 * 4. plan-progress-initiator - Ask experience level
 * 5. coaching-selector - AI coaching vs self-guided
 * 6a. If coaching: plan-generator (AI generates activities + adapts frequency)
 * 6b. If self-guided: plan-activity-selector (user picks activities)
 * 7. partner-selection
 * 8. notifications-selector (if needed)
 * 9. human/ai-partner-finder
 */
const getOnboardingSteps = (state: OnboardingState): OnboardingStep[] => [
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
      // AI coaching: go to plan generator (AI generates activities)
      if (state.wantsCoaching) return "plan-generator";
      // Self-guided: user picks their own activities
      return "plan-activity-selector";
    },
  },
  {
    id: "plan-activity-selector",
    component: PlanActivitySetter,
    next: "partner-selection",
    previous: "coaching-selector",
  },
  {
    id: "plan-generator",
    component: PlanGenerator,
    next: "partner-selection",
    previous: "coaching-selector",
  },
  {
    id: "partner-selection",
    component: PartnerTypeSelector,
    next: (state) => {
      // If notifications already granted, skip notifications step
      if (state.isPushGranted) {
        if (state.partnerType === "human") return "human-partner-finder";
        if (state.partnerType === "ai") return "ai-partner-finder";
      }
      // Otherwise, go to notifications first
      return "notifications-selector";
    },
    previous: (state) => {
      // Go back based on coaching choice
      if (state.wantsCoaching) return "plan-generator";
      return "plan-activity-selector";
    },
  },
  {
    id: "notifications-selector",
    component: NotificationsSelector,
    next: (state) => {
      if (state.partnerType === "human") return "human-partner-finder";
      if (state.partnerType === "ai") return "ai-partner-finder";
      return undefined;
    },
    previous: "partner-selection",
  },
  {
    id: "human-partner-finder",
    component: HumanPartnerFinder,
    previous: (state) => {
      // Go back to notifications if we came through that path
      if (!state.isPushGranted) return "notifications-selector";
      return "partner-selection";
    },
  },
  {
    id: "ai-partner-finder",
    component: AIPartnerFinder,
    previous: (state) => {
      if (!state.isPushGranted) return "notifications-selector";
      return "partner-selection";
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
  });

  return (
    <OnboardingProvider steps={initialSteps}>
      <OnboardingStepRenderer />
    </OnboardingProvider>
  );
}
