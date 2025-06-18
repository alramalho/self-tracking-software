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
import { ArrowRight, CheckCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";

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
];

export const NextButton = ({name, onClick, disabled}: {name: string, onClick: () => void, disabled: boolean}) => {
  return (
    <Button size="lg" className="w-full rounded-xl" onClick={onClick} disabled={disabled}>
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

  if (!currentStepData) {
    return <div>Loading...</div>;
  }

  const StepComponent = currentStepData.component;
  const isStepCompletedCallback = useMemo(() => {
    const result = isStepCompleted(currentStepData.id);
    console.log({
      isStepCompleted: result,
      currentStepData: currentStepData.id,
    });
    return result;
  }, [currentStepData.id]);

  return (
    <OnboardingContainer name={currentStepData.id}>
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
      <StepComponent />
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
