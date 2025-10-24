import { type CompletePlan } from "@/contexts/plans";
import { useRef, useState } from "react";
import AppleLikePopover from "./AppleLikePopover";
import ThreeOptionsDialogOrPopover from "./ThreeOptionsDialogOrPopover";
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
  const [isSaving, setIsSaving] = useState(false);
  const formRef = useRef<{ handleConfirm: () => Promise<void> }>(null);

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
    setIsSaving(false);
    onSuccess?.();
  };

  const handleSaveAndClose = async () => {
    setIsSaving(true);
    try {
      await formRef.current?.handleConfirm();
      // handleSuccess will be called by the form's onSuccess callback
      setShowUnsavedChangesConfirm(false);
      onClose();
    } catch (error) {
      console.error("Failed to save:", error);
      setIsSaving(false);
    }
  };

  return (
    <>
      <AppleLikePopover
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
          ref={formRef}
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

      <ThreeOptionsDialogOrPopover
        isOpen={showUnsavedChangesConfirm}
        onClose={() => setShowUnsavedChangesConfirm(false)}
        onDiscard={handleConfirmClose}
        onSave={handleSaveAndClose}
        title="Unsaved Changes"
        description="You have unsaved changes. What would you like to do?"
        saveText="Save Changes"
        discardText="Discard Changes"
        cancelText="Keep Editing"
        isSaving={isSaving}
      />
    </>
  );
} 