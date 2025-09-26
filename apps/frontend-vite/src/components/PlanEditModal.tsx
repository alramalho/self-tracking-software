import React from "react";

// Stub implementation - replace with actual implementation when needed
interface PlanEditModalProps {
  plan: any;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  scrollToMilestones?: boolean;
}

export const PlanEditModal: React.FC<PlanEditModalProps> = ({
  plan,
  isOpen,
  onClose,
  onSuccess,
  scrollToMilestones,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
        <h2 className="text-lg font-semibold mb-4">Edit Plan (placeholder)</h2>
        <p className="text-sm text-gray-500 mb-4">Plan: {plan?.goal}</p>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
          >
            Close
          </button>
          <button
            onClick={onSuccess}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};