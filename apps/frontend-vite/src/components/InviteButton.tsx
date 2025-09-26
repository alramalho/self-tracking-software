import React from "react";

// Stub implementation - replace with actual implementation when needed
interface InviteButtonProps {
  planId: string;
  onInviteSuccess: () => void;
}

const InviteButton: React.FC<InviteButtonProps> = ({
  planId,
  onInviteSuccess,
}) => {
  return (
    <button
      onClick={() => {
        console.log("Invite clicked for plan:", planId);
        onInviteSuccess();
      }}
      className="text-blue-500 hover:text-blue-700 text-sm"
    >
      Invite
    </button>
  );
};

export default InviteButton;