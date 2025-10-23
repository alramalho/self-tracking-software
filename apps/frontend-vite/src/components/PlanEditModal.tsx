import { type CompletePlan } from "@/contexts/plans";
import { useState } from "react";
import AppleLikePopover from "./AppleLikePopover";
import ConfirmDialogOrPopover from "./ConfirmDialogOrPopover";
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
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedChangesConfirm, setShowUnsavedChangesConfirm] = useState(false);

  const handleClose = () => {
    if (hasUnsavedChanges) {
      setShowUnsavedChangesConfirm(true);
    } else {
      onClose();
    }
  };

  const handleConfirmClose = () => {
    setShowUnsavedChangesConfirm(false);
    setHasUnsavedChanges(false);
    onClose();
  };

  const handleSuccess = () => {
    setHasUnsavedChanges(false);
    onSuccess?.();
  };

  return (
    <>
      <AppleLikePopover
        className={"bg-muted"}
        open={isOpen}
        onClose={handleClose}
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
          onClose={handleClose}
          onSuccess={handleSuccess}
          onFailure={onFailure}
          scrollToMilestones={scrollToMilestones}
          onUnsavedChangesChange={setHasUnsavedChanges}
        />
      </AppleLikePopover>

      <ConfirmDialogOrPopover
        isOpen={showUnsavedChangesConfirm}
        onClose={() => setShowUnsavedChangesConfirm(false)}
        onConfirm={handleConfirmClose}
        title="Unsaved Changes"
        description="You have unsaved changes. Are you sure you want to close without saving? Your changes will be lost."
        confirmText="Discard Changes"
        cancelText="Keep Editing"
        variant="destructive"
      />
    </>
  );
} 