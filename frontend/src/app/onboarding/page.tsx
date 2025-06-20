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
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { useMemo } from "react";
import { PlanProgressInitiator } from "./components/steps/PlanProgressInitiator";
import { motion } from "framer-motion";
import { PlanActivitySetter } from "./components/steps/PlanActivitySetter";
import { PlanGenerator } from "./components/steps/PlanGenerator";
import { PartnerTypeSelector } from "./components/steps/PartnerSelector";
import { NotificationsSelector } from "./components/steps/NotificationsSelector";

// Motion variants for fade in and slide up animation
const fadeUpVariants = {
  hidden: {
    opacity: 0,
    y: 10 
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      delay: 0.2,
      duration: 0.8,
      ease: "easeOut"
    }
  }
};

// Animation wrapper that applies fade up animation
const FadeUpWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <motion.div
      initial="hidden"
      animate="visible" 
      variants={fadeUpVariants}
      className="w-full h-full"
    >
      {children}
    </motion.div>
  );
};

// Higher-order component to wrap step components with motion
const withFadeUpAnimation = (Component: React.ComponentType) => {
  const WrappedComponent = () => (
    <FadeUpWrapper>
      <Component />
    </FadeUpWrapper>
  );
  WrappedComponent.displayName = `withFadeUpAnimation(${Component.displayName || Component.name})`;
  return WrappedComponent;
};

// Define your onboarding steps
const onboardingSteps: OnboardingStep[] = [
  {
    id: "welcome",
    component: withFadeUpAnimation(WelcomeStep),
  },
  {
    id: "plan-goal-setter",
    component: withFadeUpAnimation(PlanGoalSetter),
  },
  // {
  //   id: "plan-type-selector",
  //   component: withFadeUpAnimation(PlanTypeSelector),
  // },
  {
    id: "plan-activity-selector",
    component: withFadeUpAnimation(PlanActivitySetter),
  },
  {
    id: "plan-progress-initiator",
    component: withFadeUpAnimation(PlanProgressInitiator),
  },
  {
    id: "plan-generator",
    component: withFadeUpAnimation(PlanGenerator),
  },
  {
    id: "partner-selection",
    component: withFadeUpAnimation(PartnerTypeSelector),
  },
  {
    id: "notifications-selector",
    component: withFadeUpAnimation(NotificationsSelector),
  },
];


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
