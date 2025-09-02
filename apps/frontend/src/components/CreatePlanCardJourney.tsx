"use client";

import { useUserPlan } from "@/contexts/UserGlobalContext";
import { Loader2 } from "lucide-react";
import React from "react";
import toast from "react-hot-toast";
import PlanConfigurationForm from "./plan-configuration/PlanConfigurationForm";

interface CreatePlanCardJourneyProps {
  children?: React.ReactNode;
  onComplete: () => void;
}

const CreatePlanCardJourney: React.FC<CreatePlanCardJourneyProps> = ({
  children,
  onComplete,
}) => {
  const { useCurrentUserDataQuery } = useUserPlan();
  const currentUserDataQuery = useCurrentUserDataQuery();
  const { data: userData } = currentUserDataQuery;

  const handlePlanCreated = () => {
    onComplete();
  };

  const handlePlanCreationFailure = (error: string) => {
    console.error("Plan creation error:", error);
    toast.error("Failed to create plan. Please try again.");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 z-[51]">
      {children}
      {currentUserDataQuery.isLoading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin">
          Loading your progress..
        </Loader2>
      ) : (
        <PlanConfigurationForm
          onSuccess={handlePlanCreated}
          onFailure={handlePlanCreationFailure}
          title={`${userData?.name}'s New Plan`}
        />
      )}
    </div>
  );
};

export default CreatePlanCardJourney;
