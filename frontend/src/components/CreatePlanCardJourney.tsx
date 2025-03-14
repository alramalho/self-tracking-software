"use client";

import React, { useState, useEffect } from "react";
import { useApiWithAuth } from "@/api";
import { Loader2 } from "lucide-react";
import { ApiPlan, useUserPlan } from "@/contexts/UserPlanContext";
import { useNotifications } from "@/hooks/useNotifications";
import NotificationStep from "./NotificationStep";
import toast from "react-hot-toast";
import PlanConfigurationForm from "./plan-configuration/PlanConfigurationForm";

interface CreatePlanCardJourneyProps {
  children?: React.ReactNode;
  onComplete: () => void;
}

interface CreatePlanCardJourneyState {
  step: number;
  name: string;
  username: string;
}

const CreatePlanCardJourney: React.FC<CreatePlanCardJourneyProps> = ({
  children,
  onComplete,
}) => {
  const [state, setState] = useState<CreatePlanCardJourneyState>({
    step: 0,
    name: '',
    username: '',
  });
  
  const [selectedPlan, setSelectedPlan] = useState<ApiPlan | null>(null);
  const api = useApiWithAuth();
  const { useCurrentUserDataQuery } = useUserPlan();
  const currentUserDataQuery = useCurrentUserDataQuery();
  const { data: userData } = currentUserDataQuery;

  useEffect(() => {
    if (userData?.user?.username) {
      updateState({ username: userData.user.username });
    }
    if (userData?.user?.name) {
      updateState({ name: userData.user.name });
    }
  }, [userData]);

  const { step, name, username } = state;

  const updateState = (updates: Partial<CreatePlanCardJourneyState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const setStep = (newStep: number) => {
    updateState({ step: newStep });
  };

  const handleComplete = () => {
    onComplete();
  };

  const { requestPermission, isPushGranted } = useNotifications();

  const createPlan = async (plan: ApiPlan) => {
    try {
      const response = await api.post("/create-plan", {
        ...plan,
      });
      const createdPlan = response.data.plan;
      setSelectedPlan(createdPlan);
      currentUserDataQuery.refetch();
      setStep(1);
    } catch (error) {
      console.error("Plan creation error:", error);
      toast.error("Failed to create plan. Please try again.");
    }
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <PlanConfigurationForm
            onConfirm={createPlan}
            title={`${name}'s New Plan`}
          />
        );
      case 1:
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
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 z-[51]">
      {children}
      {currentUserDataQuery.isLoading ? (
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
