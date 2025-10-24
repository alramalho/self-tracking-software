import { Visibility } from "@tsw/prisma";
import { Earth, Lock, Users } from "lucide-react";
import React from "react";
import Number from "../Number";

interface VisibilityStepProps {
  visibility: Visibility;
  setVisibility: (visibility: Visibility) => void;
  number: number;
}

const VisibilityOption = ({
  icon: Icon,
  title,
  description,
  isSelected,
  onSelect,
}: {
  icon: typeof Earth;
  title: string;
  description: string;
  isSelected: boolean;
  onSelect: () => void;
}) => (
  <button
    type="button"
    onClick={onSelect}
    className={`bg-input p-4 rounded-lg border-2 transition-all text-left ${
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

const VisibilityStep: React.FC<VisibilityStepProps> = ({
  visibility,
  setVisibility,
  number,
}) => {
  return (
    <div className="space-y-4">
      <label className="text-lg font-medium block flex items-center gap-2">
        <Number>{number}</Number>
        Who can see this plan?
      </label>

      <div className="space-y-3">
        <VisibilityOption
          icon={Earth}
          title="Public"
          description="Everyone can see this plan, including activity entries"
          isSelected={visibility === "PUBLIC"}
          onSelect={() => setVisibility("PUBLIC")}
        />

        <VisibilityOption
          icon={Users}
          title="Friends Only"
          description="Only your connections can see this plan and activity entries"
          isSelected={visibility === "FRIENDS"}
          onSelect={() => setVisibility("FRIENDS")}
        />

        <VisibilityOption
          icon={Lock}
          title="Private"
          description="Only you can see this plan. It won't appear on your profile to others"
          isSelected={visibility === "PRIVATE"}
          onSelect={() => setVisibility("PRIVATE")}
        />
      </div>
    </div>
  );
};

export default VisibilityStep;
