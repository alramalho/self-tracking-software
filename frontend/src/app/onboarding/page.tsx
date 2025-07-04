"use client";

import {
  OnboardingProvider,
  useOnboarding,
  OnboardingStep,
} from "./components/OnboardingContext";
import { OnboardingContainer } from "./components/container";
import { ProgressBar } from "@/components/ProgressBar";
import WelcomeStep from "./components/steps/WelcomeStep";
import PlanGoalSetter from "./components/steps/PlanGoalSetter";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useMemo } from "react";
import PlanProgressInitiator from "./components/steps/PlanProgressInitiator";
import PlanActivitySetter from "./components/steps/PlanActivitySetter";
import PlanGenerator from "./components/steps/PlanGenerator";
import PartnerTypeSelector from "./components/steps/PartnerSelector";
import NotificationsSelector from "./components/steps/NotificationsSelector";
import HumanPartnerFinder from "./components/steps/HumanPartnerFinder";
import { useNotifications } from "@/hooks/useNotifications";
import AIPartnerFinder from "./components/steps/AIPartnerFinder";

const OnboardingStepRenderer = () => {
  const {
    currentStepData,
    currentStep,
    totalSteps,
    prevStep,
    nextStep,
    isStepCompleted,
    steps,
  } = useOnboarding();

  const isStepCompletedCallback = useMemo(() => {
    if (!currentStepData) return false;
    const result = isStepCompleted(currentStepData.id);
    return result;
  }, [currentStepData?.id, isStepCompleted]);

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
        className="fixed top-2 left-2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 cursor-pointer"
      />
      {isStepCompletedCallback && (
        <ChevronRight
          onClick={nextStep}
          className="fixed top-2 right-2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 cursor-pointer"
        />
      )}

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
export default function OnboardingPage() {
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
    // {
    //   id: "plan-type-selector",
    //   component: PlanTypeSelector,
    // },
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
