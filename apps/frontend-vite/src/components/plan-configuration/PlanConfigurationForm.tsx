import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/contexts/users";
import { Loader2 } from "lucide-react";
import React from "react";
import toast from "react-hot-toast";

interface PlanConfigurationFormProps {
  onSuccess?: () => void;
  onFailure?: (error: string) => void;
  onClose?: () => void;
  title: string;
  isEdit?: boolean;
  plan?: any;
  scrollToMilestones?: boolean;
}

// Simplified stub implementation - TODO: Migrate full form with all steps
const PlanConfigurationForm: React.FC<PlanConfigurationFormProps> = ({
  onSuccess,
  onFailure,
  title,
}) => {
  const { currentUser, isLoadingCurrentUser } = useCurrentUser();

  const handleCreatePlan = () => {
    toast.error("Plan creation form not fully migrated yet");
    onFailure?.("Not implemented");
  };

  if (isLoadingCurrentUser) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-sm">
      <h2 className="text-xl font-semibold mb-4">{title}</h2>
      <div className="space-y-4">
        <p className="text-gray-600">
          Plan configuration form is being migrated from the old frontend.
        </p>
        <p className="text-sm text-gray-500">
          TODO: Migrate full PlanConfigurationForm with:
          <ul className="list-disc list-inside ml-4 mt-2">
            <li>Duration selection step</li>
            <li>Goal input step</li>
            <li>Emoji selection step</li>
            <li>Activities selection step</li>
            <li>Outline/sessions generation step</li>
            <li>Milestones configuration step</li>
          </ul>
        </p>
        <Button onClick={handleCreatePlan} className="w-full">
          Create Plan (Not Implemented)
        </Button>
      </div>
    </div>
  );
};

export default PlanConfigurationForm;