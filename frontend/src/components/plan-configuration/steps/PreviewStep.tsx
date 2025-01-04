import React from "react";
import Number from "../Number";
import { Button } from "@/components/ui/button";
import { GeneratedPlan } from "@/contexts/UserPlanContext";
import GeneratedPlanRenderer from "@/components/GeneratedPlanRenderer";

interface PreviewStepProps {
  title: string;
  generatedPlan: GeneratedPlan;
  onRegenerate: () => void;
}

const PreviewStep: React.FC<PreviewStepProps> = ({
  title,
  generatedPlan,
  onRegenerate,
}) => {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <Number>6</Number>
        Preview & Accept Plan
      </h3>
      <GeneratedPlanRenderer title={title} plan={generatedPlan} />
      <Button
        variant="outline"
        className="w-full bg-gray-50"
        onClick={onRegenerate}
      >
        Regenerate
      </Button>
    </div>
  );
};

export default PreviewStep; 