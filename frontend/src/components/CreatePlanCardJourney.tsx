"use client";

import React, { useState, useEffect } from "react";
import { useApiWithAuth } from "@/api";
import { Loader2 } from "lucide-react";
import { ApiPlan, GeneratedPlan, useUserPlan } from "@/contexts/UserPlanContext";
import { useNotifications } from "@/hooks/useNotifications";
import NameStep from "./NameStep";
import UsernameStep from "./UsernameStep";
import InviteStep from "./InviteStep";
import NotificationStep from "./NotificationStep";
import toast from "react-hot-toast";
import PlanConfigurationForm from "./PlanConfigurationForm";

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

  const handlePlanSelection = async (plan: GeneratedPlan) => {
    try {
      const response = await api.post("/create-plan", {
        ...plan,
      });
      const createdPlan = response.data.plan;
      setSelectedPlan(createdPlan);
      userDataQuery.refetch();
      setStep(2);
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
            onConfirm={handlePlanSelection}
            title={`${name}'s New Plan`}
          />
        );
      case 1:
        if (!selectedPlan) {
          if (localStorage.getItem('createPlanCardJourneyState')) {
            localStorage.removeItem('createPlanCardJourneyState');
            window.location.reload();
          }
          return <span>Oops, something went wrong. Please be so kind to open a bug request!</span>;
        }
        return (
          <InviteStep
            selectedPlan={selectedPlan}
            onNext={() => setStep(2)}
            userDataQuery={userDataQuery}
          />
        );
      case 2:
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
