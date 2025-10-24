import { useCurrentUser } from "@/contexts/users";
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
  const { currentUser, isLoadingCurrentUser } = useCurrentUser();

  const handlePlanCreated = () => {
    onComplete();
  };

  const handlePlanCreationFailure = (error: string) => {
    console.error("Plan creation error:", error);
    toast.error("Failed to create plan. Please try again.");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 z-[51]">
      {children}
      {isLoadingCurrentUser ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin">
          Loading your progress..
        </Loader2>
      ) : (
        <PlanConfigurationForm
          onSuccess={handlePlanCreated}
          onFailure={handlePlanCreationFailure}
          title={`${currentUser?.name}'s New Plan`}
        />
      )}
    </div>
  );
};

export default CreatePlanCardJourney;