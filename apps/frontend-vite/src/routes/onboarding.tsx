import { OnboardingContainer } from "@/components/OnboardingContainer";
import { ProgressBar } from "@/components/ProgressBar";
import AIPartnerFinder from "@/components/steps/AIPartnerFinder";
import HumanPartnerFinder from "@/components/steps/HumanPartnerFinder";
import NotificationsSelector from "@/components/steps/NotificationsSelector";
import PartnerTypeSelector from "@/components/steps/PartnerSelector";
import PlanActivitySetter from "@/components/steps/PlanActivitySetter";
import PlanGenerator from "@/components/steps/PlanGenerator";
import PlanGoalSetter from "@/components/steps/PlanGoalSetter";
import PlanProgressInitiator from "@/components/steps/PlanProgressInitiator";
import { PlanTypeSelector } from "@/components/steps/PlanTypeSelector";
import WelcomeStep from "@/components/steps/WelcomeStep";
import { OnboardingProvider } from "@/contexts/onboarding/provider";
import { type OnboardingStep } from "@/contexts/onboarding/types";
import { useOnboarding } from "@/contexts/onboarding/useOnboarding";
import { useNotifications } from "@/hooks/useNotifications";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useMemo } from "react";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
});

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
        className="fixed m-0 top-8 left-2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 cursor-pointer"
      />

      {!currentStepData ? (
        <div className="flex flex-col items-center justify-center h-full">
          <X size={48} className="text-red-500 mb-4" />
          <p className="text-gray-600">Error loading step</p>
        </div>
      ) : (
        <currentStepData.component />
      )}
    </OnboardingContainer>
  );
};

// Main onboarding page
function OnboardingPage() {
  const { isPushGranted } = useNotifications();

  // Define your onboarding steps
  const onboardingSteps: OnboardingStep[] = [
    {
      id: "welcome",
      component: WelcomeStep,
    },
    {
      id: "plan-goal-setter",
      component: PlanGoalSetter,
    },
    {
      id: "plan-type-selector",
      component: PlanTypeSelector,
    },
    {
      id: "plan-activity-selector",
      component: PlanActivitySetter,
    },
    {
      id: "plan-progress-initiator",
      component: PlanProgressInitiator,
    },
    {
      id: "plan-generator",
      component: PlanGenerator,
    },
    {
      id: "partner-selection",
      component: PartnerTypeSelector,
      previous: "plan-progress-initiator",
    },
    {
      id: "notifications-selector",
      component: NotificationsSelector,
    },
    {
      id: "human-partner-finder",
      component: HumanPartnerFinder,
      previous: "partner-selection",
    },
    {
      id: "ai-partner-finder",
      component: AIPartnerFinder,
      previous: "partner-selection",
    },
  ];

  return (
    <OnboardingProvider steps={onboardingSteps}>
      <OnboardingStepRenderer />
    </OnboardingProvider>
  );
}
