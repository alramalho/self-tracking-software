import { BadgeCheck, X } from "lucide-react";
import React from "react";
import Number from "../Number";

interface CoachingStepProps {
  isCoached: boolean;
  setIsCoached: (isCoached: boolean) => void;
  number: number;
}

const CoachingOption = ({
  icon: Icon,
  title,
  description,
  isSelected,
  onSelect,
}: {
  icon: typeof BadgeCheck;
  title: string;
  description: string;
  isSelected: boolean;
  onSelect: () => void;
}) => (
  <button
    type="button"
    onClick={onSelect}
    className={`p-4 rounded-lg border-2 transition-all text-left ${
      isSelected
        ? "border-primary bg-primary/5"
        : "border-border hover:border-primary/50"
    }`}
  >
    <div className="flex items-start gap-3">
      <Icon className={`w-5 h-5 mt-0.5 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
      <div className="flex-1">
        <div className="font-medium mb-1">{title}</div>
        <div className="text-sm text-muted-foreground">{description}</div>
      </div>
    </div>
  </button>
);

const CoachingStep: React.FC<CoachingStepProps> = ({
  isCoached,
  setIsCoached,
  number,
}) => {
  return (
    <div className="space-y-4">
      <label className="text-lg font-medium block flex items-center gap-2">
        <Number>{number}</Number>
        Enable AI Coaching?
      </label>

      <div className="space-y-3">
        <CoachingOption
          icon={BadgeCheck}
          title="Yes, coach this plan"
          description="Get personalized AI coaching and guidance for this plan"
          isSelected={isCoached}
          onSelect={() => setIsCoached(true)}
        />

        <CoachingOption
          icon={X}
          title="No coaching"
          description="Track this plan independently without AI coaching"
          isSelected={!isCoached}
          onSelect={() => setIsCoached(false)}
        />
      </div>
    </div>
  );
};

export default CoachingStep;
