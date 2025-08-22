import AppleLikePopover from "./AppleLikePopover";
import PlanConfigurationForm from "./plan-configuration/PlanConfigurationForm";
import { CompletePlan } from "@/contexts/UserGlobalContext";

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
      className={"bg-gray-50"}
      open={isOpen}
      onClose={onClose}
    >
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