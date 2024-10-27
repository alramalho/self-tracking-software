import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import UserSearch, { UserSearchResult } from "./UserSearch";
import { useApiWithAuth } from "@/api";
import { toast } from "react-hot-toast";
import AppleLikePopover from "./AppleLikePopover";

interface InviteButtonProps {
  planId: string;
  onInviteSuccess: () => void;
  buttonText?: string;
  embedded?: boolean;
}

const InviteButton: React.FC<InviteButtonProps> = ({
  planId,
  onInviteSuccess,
  buttonText = "Invite",
  embedded = false,
}) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [invitees, setInvitees] = useState<UserSearchResult[]>([]);
  const api = useApiWithAuth();

  const handleUserSelect = (user: UserSearchResult) => {
    if (!invitees.some((invitee) => invitee.user_id === user.user_id)) {
      setInvitees([...invitees, user]);
    }
  };

  const removeInvitee = (userIdToRemove: string) => {
    setInvitees(
      invitees.filter((invitee) => invitee.user_id !== userIdToRemove)
    );
  };

  const handleInvite = async () => {
    try {
      await Promise.all(
        invitees.map((invitee) =>
          api.post(`/invite-to-plan/${planId}/${invitee.user_id}`)
        )
      );
      toast.success("Invitations sent successfully!");
      onInviteSuccess();
      setIsSearchOpen(false);
      setInvitees([]);
    } catch (error) {
      console.error("Error sending invitations:", error);
      toast.error("Failed to send invitations. Please try again.");
    }
  };

  if (embedded) {
    return (
      <UserSearch
        onUserClick={handleUserSelect}
        selectedUsers={invitees}
        onUserRemove={removeInvitee}
      />
    );
  }
  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          setIsSearchOpen(!isSearchOpen);
        }}
      >
        <UserPlus className="h-4 w-4 mr-2" />
        {buttonText}
      </Button>
      {isSearchOpen && (
        <AppleLikePopover onClose={() => setIsSearchOpen(false)}>
          <UserSearch
            onUserClick={handleUserSelect}
            selectedUsers={invitees}
            onUserRemove={removeInvitee}
          />
          <Button
            className="w-full mt-4"
            onClick={handleInvite}
            disabled={invitees.length === 0}
          >
            {buttonText} ({invitees.length})
          </Button>
        </AppleLikePopover>
      )}
    </div>
  );
};

export default InviteButton;
