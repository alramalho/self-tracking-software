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

interface CreatePlanCardJourneyProps {
  children?: React.ReactNode;
  onComplete: () => void;
}

interface CreatePlanCardJourneyState {
  step: number;
  name: string;
  username: string;
  goal: string;
  finishingDate?: Date;
  selectedEmoji: string;
  planDescription: string;
  generatedPlans: GeneratedPlan[];
}

const CreatePlanCardJourney: React.FC<CreatePlanCardJourneyProps> = ({
  children,
  onComplete,
}) => {
  // Load initial state from localStorage or use defaults
  const loadInitialState = (): CreatePlanCardJourneyState => {
    if (typeof window === 'undefined') return getDefaultState();
    
    const saved = localStorage.getItem('createPlanCardJourneyState');
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...parsed,
        finishingDate: parsed.finishingDate ? new Date(parsed.finishingDate) : undefined,
      };
    }
    return getDefaultState();
  };

  const getDefaultState = (): CreatePlanCardJourneyState => ({
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
  const [state, setState] = useState<CreatePlanCardJourneyState>(loadInitialState);
  const [selectedPlan, setSelectedPlan] = useState<ApiPlan | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const api = useApiWithAuth();
  const { useUserDataQuery } = useUserPlan();
  const userDataQuery = useUserDataQuery("me");
  const userData = userDataQuery.data;  

  useEffect(() => {
    if (userData?.user?.username) {
      updateState({ username: userData.user.username });
    }
    if (userData?.user?.name) {
      updateState({ name: userData.user.name });
    }
  }, [userData]);

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
      localStorage.setItem('createPlanCardJourneyState', JSON.stringify(state));
    }
  }, [state]);

  // Helper function to update state
  const updateState = (updates: Partial<CreatePlanCardJourneyState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  // Update the step setter
  const setStep = (newStep: number) => {
    updateState({ step: newStep });
  };

  // Modify other setters to use updateState
  const setGoal = (newGoal: string) => updateState({ goal: newGoal });
  const setFinishingDate = (date: Date | undefined) => updateState({ finishingDate: date });
  const setSelectedEmoji = (emoji: string) => updateState({ selectedEmoji: emoji });
  const setPlanDescription = (desc: string) => updateState({ planDescription: desc });
  const setGeneratedPlans = (plans: GeneratedPlan[]) => updateState({ generatedPlans: plans });

  // Clear localStorage when createPlanCardJourney is complete
  const handleComplete = () => {
    localStorage.removeItem('createPlanCardJourneyState');
    onComplete();
  };

  // Add back the notifications context
  const { requestPermission, isPushGranted } = useNotifications();

  // Simplify the plan selection handler
  const handlePlanSelection = async (plan: GeneratedPlan) => {
    try {
      const response = await api.post("/create-plan", {
        ...plan,
        emoji: selectedEmoji,
      });
      const createdPlan = response.data.plan;
      setSelectedPlan(createdPlan);
      userDataQuery.refetch();
      setStep(4);
    } catch (error) {
      console.error("Plan creation error:", error);
      toast.error("Failed to create plan. Please try again.");
    }
  };

  // Update the renderStep function
  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <GoalStep
            goal={goal}
            setGoal={setGoal}
            onNext={() => setStep(1)}
          />
        );
      case 1:
        return (
          <EmojiStep
            selectedEmoji={selectedEmoji}
            setSelectedEmoji={setSelectedEmoji}
            onNext={() => setStep(2)}
          />
        );
      case 2:
        return (
          <FinishingDateStep
            finishingDate={finishingDate}
            setFinishingDate={setFinishingDate}
            onNext={() => setStep(3)}
          />
        );
      case 3:
        return (
          <PlanGenerationStep
            goal={goal}
            finishingDate={finishingDate?.toISOString().split('T')[0]}
            handlePlanSelection={handlePlanSelection}
            name={name}
          />
        );
      case 4:
        return (
          <InviteStep
            selectedPlan={selectedPlan}
            onNext={() => setStep(5)}
            userDataQuery={userDataQuery}
          />
        );
      case 5:
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
      {children}

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

export default CreatePlanCardJourney;
