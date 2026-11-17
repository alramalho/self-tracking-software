import { usePlanCreation } from "@/contexts/plan-creation";
import { withFadeUpAnimation } from "@/contexts/plan-creation/lib";
import { Button } from "@/components/ui/button";
import { Earth, Lock, EyeOff, Eye } from "lucide-react";

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
    className={`w-full text-left rounded-2xl overflow-hidden relative group cursor-pointer p-4 border-2 transition-all ${
      isSelected
        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
    }`}
  >
    <div className="flex items-start gap-3">
      <Icon className={`w-6 h-6 mt-0.5 ${isSelected ? "text-blue-500" : "text-muted-foreground"}`} />
      <div className="flex-1">
        <div className="font-medium mb-1">{title}</div>
        <div className="text-sm text-muted-foreground">{description}</div>
      </div>
    </div>
  </button>
);

const VisibilityStepWizard = () => {
  const { visibility, setVisibility, completeStep } = usePlanCreation();

  const handleContinue = () => {
    completeStep("visibility");
  };

  return (
    <div className="w-full max-w-lg space-y-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex flex-col items-center gap-2">
          <Eye className="w-16 h-16 text-blue-600" />
          <h2 className="text-2xl mt-2 font-bold tracking-tight text-foreground">
            Who can see this plan?
          </h2>
        </div>
        <p className="text-md text-muted-foreground">
          Choose what your profile and friends' feeds show
        </p>
      </div>

      <div className="space-y-3 px-2">
        <VisibilityOption
          icon={Earth}
          title="Everyone"
          description="Your profile shows this plan and its logs."
          isSelected={visibility === "PUBLIC" || visibility === "FRIENDS"}
          onSelect={() => setVisibility("PUBLIC")}
        />

        <VisibilityOption
          icon={EyeOff}
          title="Hide the plan"
          description="Your logs still show, without the plan."
          isSelected={visibility === "LOGS_ONLY"}
          onSelect={() => setVisibility("LOGS_ONLY")}
        />

        <VisibilityOption
          icon={Lock}
          title="Hide everything"
          description="Only you see this plan and its logs. A log also in a visible plan still shows."
          isSelected={visibility === "PRIVATE"}
          onSelect={() => setVisibility("PRIVATE")}
        />
      </div>

      <div className="px-2">
        <Button onClick={handleContinue} className="w-full">
          Continue
        </Button>
      </div>
    </div>
  );
};

export default withFadeUpAnimation(VisibilityStepWizard);
