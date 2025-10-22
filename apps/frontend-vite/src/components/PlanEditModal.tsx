import { type CompletePlan } from "@/contexts/plans";
import AppleLikePopover from "./AppleLikePopover";
import PlanConfigurationForm from "./plan-configuration/PlanConfigurationForm";

interface PlanEditModalProps {
  plan: CompletePlan;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onFailure?: (error: string) => void;
  scrollToMilestones?: boolean;
}

export function PlanEditModal({
  plan,
  isOpen,
  onClose,
  onSuccess,
  onFailure,
  scrollToMilestones = false,
}: PlanEditModalProps) {
  return (
    <AppleLikePopover
      className={"bg-muted"}
      open={isOpen}
      onClose={onClose}
      title="Edit Plan"
    >
      <div className="text-center mb-6 mt-4">
        <div className="text-6xl mb-3">
          {plan.emoji || "📋"}
        </div>
        <h3 className="text-lg font-semibold">
          {plan.goal}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Update your plan details
        </p>
      </div>
      <PlanConfigurationForm
        isEdit={true}
        plan={plan}
        title={plan.goal}
        onClose={onClose}
        onSuccess={onSuccess}
        onFailure={onFailure}
        scrollToMilestones={scrollToMilestones}
      />
    </AppleLikePopover>
  );
} 