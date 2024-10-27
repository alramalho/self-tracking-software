import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import UserSearch, { UserSearchResult } from "./UserSearch";
import { useApiWithAuth } from "@/api";
import { toast } from "react-hot-toast";

interface InviteButtonProps {
  planId: string;
  onInviteSuccess: () => void;
  buttonText?: string;
}

const InviteButton: React.FC<InviteButtonProps> = ({ planId, onInviteSuccess, buttonText = "Invite" }) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [invitees, setInvitees] = useState<UserSearchResult[]>([]);
  const api = useApiWithAuth();

  const handleUserSelect = (user: UserSearchResult) => {
    if (!invitees.some(invitee => invitee.user_id === user.user_id)) {
      setInvitees([...invitees, user]);
    }
  };

  const removeInvitee = (userIdToRemove: string) => {
    setInvitees(invitees.filter(invitee => invitee.user_id !== userIdToRemove));
  };

  const handleInvite = async () => {
    try {
      await Promise.all(invitees.map(invitee => 
        api.post(`/invite-to-plan/${planId}/${invitee.user_id}`)
      ));
      toast.success("Invitations sent successfully!");
      onInviteSuccess();
      setIsSearchOpen(false);
      setInvitees([]);
    } catch (error) {
      console.error("Error sending invitations:", error);
      toast.error("Failed to send invitations. Please try again.");
    }
  };

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
        <div className="absolute z-10 mt-2 w-64 bg-white shadow-lg rounded-md overflow-hidden p-4">
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
        </div>
      )}
    </div>
  );
};

export default InviteButton;
