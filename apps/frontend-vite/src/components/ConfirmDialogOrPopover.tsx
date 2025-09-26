import React from "react";

// Stub implementation - replace with actual implementation when needed
interface ConfirmDialogOrPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: React.ReactNode;
  description: string;
  confirmText: string;
  cancelText: string;
  variant?: string;
}

const ConfirmDialogOrPopover: React.FC<ConfirmDialogOrPopoverProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText,
  cancelText,
  variant,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
        <div className="mb-4">{title}</div>
        <p className="text-sm text-gray-600 mb-6">{description}</p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded text-white ${
              variant === "destructive"
                ? "bg-red-500 hover:bg-red-600"
                : "bg-blue-500 hover:bg-blue-600"
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialogOrPopover;