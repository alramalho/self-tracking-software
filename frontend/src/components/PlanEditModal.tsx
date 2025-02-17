import { ApiPlan } from "@/contexts/UserPlanContext";
import AppleLikePopover from "./AppleLikePopover";
import PlanConfigurationForm from "./plan-configuration/PlanConfigurationForm";

interface PlanEditModalProps {
  plan: ApiPlan;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (updatedPlan: ApiPlan) => Promise<void>;
  scrollToMilestones?: boolean;
}

export function PlanEditModal({ 
  plan, 
  isOpen, 
  onClose, 
  onConfirm,
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
        onConfirm={onConfirm}
        scrollToMilestones={scrollToMilestones}
      />
    </AppleLikePopover>
  );
} 