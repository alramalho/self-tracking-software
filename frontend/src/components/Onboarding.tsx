"use client";

import React, { useState, useEffect } from "react";
import { useApiWithAuth } from "@/api";
import { Loader2 } from "lucide-react";
import { ApiPlan, GeneratedPlan, useUserPlan } from "@/contexts/UserPlanContext";
import { useNotifications } from "@/hooks/useNotifications";
import NameStep from "./NameStep";
import UsernameStep from "./UsernameStep";
import GoalStep from "./GoalStep";
import EmojiStep from "./EmojiStep";
import FinishingDateStep from "./FinishingDateStep";
import PlanGenerationStep from "./PlanGenerationStep";
import InviteStep from "./InviteStep";
import NotificationStep from "./NotificationStep";
import toast from "react-hot-toast";

interface OnboardingProps {
  isNewPlan?: boolean;
  onComplete: () => void;
}

interface OnboardingState {
  step: number;
  name: string;
  username: string;
  goal: string;
  finishingDate?: Date;
  selectedEmoji: string;
  planDescription: string;
  generatedPlans: GeneratedPlan[];
}

const Onboarding: React.FC<OnboardingProps> = ({
  isNewPlan = false,
  onComplete,
}) => {
  // Load initial state from localStorage or use defaults
  const loadInitialState = (): OnboardingState => {
    if (typeof window === 'undefined') return getDefaultState();
    
    const saved = localStorage.getItem('onboardingState');
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...parsed,
        finishingDate: parsed.finishingDate ? new Date(parsed.finishingDate) : undefined,
      };
    }
    return getDefaultState();
  };

  const getDefaultState = (): OnboardingState => ({
    step: 0,
    name: '',
    username: '',
    goal: '',
    finishingDate: undefined,
    selectedEmoji: '',
    planDescription: '',
    generatedPlans: [],
  });

  // Replace individual state declarations with a single state object
  const [state, setState] = useState<OnboardingState>(loadInitialState);
  const [selectedPlan, setSelectedPlan] = useState<ApiPlan | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUsernameAvailable, setIsUsernameAvailable] = useState(true);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const api = useApiWithAuth();
  const { useUserDataQuery } = useUserPlan();
  const userDataQuery = useUserDataQuery("me");
  const userData = userDataQuery.data;  

  // Destructure state for easier access
  const {
    step,
    name,
    username,
    goal,
    finishingDate,
    selectedEmoji,
    planDescription,
    generatedPlans,
  } = state;

  // Save to localStorage whenever state changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('onboardingState', JSON.stringify(state));
    }
  }, [state]);

  // Helper function to update state
  const updateState = (updates: Partial<OnboardingState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  // Update the step setter
  const setStep = (newStep: number) => {
    updateState({ step: newStep });
  };

  // Modify other setters to use updateState
  const setName = (newName: string) => updateState({ name: newName });
  const setUsername = (newUsername: string) => updateState({ username: newUsername });
  const setGoal = (newGoal: string) => updateState({ goal: newGoal });
  const setFinishingDate = (date: Date | undefined) => updateState({ finishingDate: date });
  const setSelectedEmoji = (emoji: string) => updateState({ selectedEmoji: emoji });
  const setPlanDescription = (desc: string) => updateState({ planDescription: desc });
  const setGeneratedPlans = (plans: GeneratedPlan[]) => updateState({ generatedPlans: plans });

  // Clear localStorage when onboarding is complete
  const handleComplete = () => {
    localStorage.removeItem('onboardingState');
    onComplete();
  };

  // Modify the existing useEffect for userData
  useEffect(() => {
    try {
      if (userData && step < 2) {
        if (userData.user?.name) {
          updateState({
            name: userData.user.name,
            step: 1
          });
        }
        if (userData.user?.username) {
          updateState({
            username: userData.user.username,
            step: 2
          });
        }
      }
    } catch (error) {
      console.error("Error loading user data:", error);
      toast.error("Error loading user data");
    }
  }, [userData]);

  // Add back the notifications context
  const { requestPermission, isPushGranted } = useNotifications();

  // Add back the handlePlanSelection function
  const handlePlanSelection = async (plan: GeneratedPlan) => {
    console.log({ planToBeCreated: plan });
    try {
      if (plan) {
        const response = await api.post("/create-plan", {
          ...plan,
          emoji: selectedEmoji,
        });
        const createdPlan = response.data.plan;
        setSelectedPlan(createdPlan);
        userDataQuery.refetch();
        setStep(6);
      }
    } catch (error) {
      console.error("Plan creation error:", error);
      toast.error("Failed to create plan. Please try again.");
    }
  };

  // Update handleGeneratePlans to handle Date object correctly
  const handleGeneratePlans = async () => {
    setIsGenerating(true);
    try {
      const response = await api.post("/generate-plans", {
        goal,
        // Only call toISOString if finishingDate is defined
        finishingDate: finishingDate ? finishingDate.toISOString().split("T")[0] : undefined,
        planDescription: planDescription.trim() || undefined,
        emoji: selectedEmoji,
      });

      setGeneratedPlans(response.data.plans);
    } catch (error) {
      console.error("Error generating plan:", error);
      toast.error("Failed to generate plan. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Update the final NotificationStep to use handleComplete
  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <NameStep
            name={name}
            setName={setName}
            onNext={() => setStep(1)}
            isNewPlan={isNewPlan}
            api={api}
            userDataQuery={userDataQuery}
          />
        );
      case 1:
        return (
          <UsernameStep
            username={username}
            setUsername={setUsername}
            isUsernameAvailable={isUsernameAvailable}
            isCheckingUsername={isCheckingUsername}
            onNext={() => setStep(2)}
            api={api}
            userDataQuery={userDataQuery}
          />
        );
      case 2:
        return (
          <GoalStep
            goal={goal}
            setGoal={setGoal}
            onNext={() => setStep(3)}
          />
        );
      case 3:
        return (
          <EmojiStep
            selectedEmoji={selectedEmoji}
            setSelectedEmoji={setSelectedEmoji}
            onNext={() => setStep(4)}
          />
        );
      case 4:
        return (
          <FinishingDateStep
            finishingDate={finishingDate}
            setFinishingDate={setFinishingDate}
            onNext={() => setStep(5)}
          />
        );
      case 5:
        return (
          <PlanGenerationStep
            planDescription={planDescription}
            setPlanDescription={setPlanDescription}
            handleGeneratePlans={handleGeneratePlans}
            isGenerating={isGenerating}
            generatedPlans={generatedPlans}
            handlePlanSelection={handlePlanSelection}
            name={name}
          />
        );
      case 6:
        return (
          <InviteStep
            selectedPlan={selectedPlan}
            onNext={() => setStep(7)}
            userDataQuery={userDataQuery}
          />
        );
      case 7:
        return (
          <NotificationStep
            onComplete={handleComplete}
            requestPermission={requestPermission}
            isPushGranted={isPushGranted}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <h1 className="text-2xl font-bold mb-8">
        {isNewPlan
          ? "Create New Plan"
          : "Welcome to the Self Tracking App! Let's get you started."}
      </h1>
      {userDataQuery.isLoading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin">
          Loading your progress..
        </Loader2>
      ) : (
        renderStep()
      )}
    </div>
  );
};

export default Onboarding;
