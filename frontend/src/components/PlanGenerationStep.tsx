import React from "react";
import { GeneratedPlan } from "@/contexts/UserPlanContext";
import PlanConfigurationForm from "./PlanConfigurationForm";

interface PlanGenerationStepProps {
  goal: string;
  finishingDate?: string;
  handlePlanSelection: (plan: GeneratedPlan) => Promise<void>;
  name: string;
}

const PlanGenerationStep: React.FC<PlanGenerationStepProps> = ({
  goal,
  finishingDate,
  handlePlanSelection,
  name,
}) => {
  return (
    <PlanConfigurationForm
      goal={goal}
      finishingDate={finishingDate}
      onConfirm={handlePlanSelection}
      onClose={() => {}} // Handle as needed
      title={`${name}'s New Plan`}
    />
  );
};

export default PlanGenerationStep;
