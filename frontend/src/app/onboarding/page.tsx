"use client";

import {
  OnboardingProvider,
  useOnboarding,
  OnboardingStep,
} from "./components/OnboardingContext";
import { OnboardingContainer } from "./components/container";
import { ProgressBar } from "@/components/ProgressBar";
import { WelcomeStep } from "./components/steps/WelcomeStep";
import { PlanGoalSetter } from "./components/steps/PlanGoalSetter";
import {
  ArrowRight,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { PlanTypeSelector } from "./components/steps/PlanTypeSelector";

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
];

export const NextButton = ({
  name,
  onClick,
  disabled,
}: {
  name: string;
  onClick: () => void;
  disabled: boolean;
}) => {
  return (
    <Button
      size="lg"
      className="w-full rounded-xl"
      onClick={onClick}
      disabled={disabled}
    >
      {name}
      <ArrowRight size={20} className="ml-2" />
    </Button>
  );
};

// Component that renders the current step
const OnboardingStepRenderer = () => {
  const {
    currentStepData,
    currentStep,
    totalSteps,
    prevStep,
    nextStep,
    isStepCompleted,
  } = useOnboarding();

  const isStepCompletedCallback = useMemo(() => {
    if (!currentStepData) return false;
    const result = isStepCompleted(currentStepData.id);
    return result;
  }, [currentStepData?.id, isStepCompleted]);

  return (
    <OnboardingContainer name={currentStepData?.id || "error"}>
      <ProgressBar
        current={currentStep + 1}
        max={totalSteps}
        className="fixed top-0 left-0 rounded-none"
      />
      <ChevronLeft
        onClick={prevStep}
        className="absolute top-2 left-2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 cursor-pointer"
      />
      {isStepCompletedCallback && (
        <ChevronRight
          onClick={nextStep}
          className="absolute top-2 right-2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 cursor-pointer"
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
  return (
    <OnboardingProvider steps={onboardingSteps}>
      <OnboardingStepRenderer />
    </OnboardingProvider>
  );
}
