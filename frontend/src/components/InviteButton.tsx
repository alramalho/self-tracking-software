import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Link, UserPlus } from "lucide-react";
import UserSearch, { UserSearchResult } from "./UserSearch";
import { useApiWithAuth } from "@/api";
import { toast } from "react-hot-toast";
import AppleLikePopover from "./AppleLikePopover";
import Divider from "./Divider";
import { useClipboard } from "@/hooks/useClipboard";

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
  const [, copyToClipboard] = useClipboard();

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

  const generateCopyLink = async () => {
    const response = await api.get(
      `/generate-invitation-link?plan_id=${planId}`
    );
    return response.data.link;
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

  const handleCopyLink = async () => {
    toast.promise(
      (async () => {
        const link = await generateCopyLink();
        const success = await copyToClipboard(link);
        if (!success) throw new Error("Failed to copy");
        return "Copied invite link to clipboard";
      })(),
      {
        loading: "Generating invite link...",
        success: "Copied invite link to clipboard",
        error: "Failed to generate invite link",
      }
    );
  };

  if (embedded) {
    return (
      <>
        <Button
          variant="outline"
          className="mt-4 text-md w-full p-6 bg-gray-100"
          onClick={async () => {
            await handleCopyLink();
            onInviteSuccess();
          }}
        >
          <Link className="mr-3 h-7 w-7" />
          Copy Invite Link
        </Button>
        <Divider text="OR" />
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
      </>
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
          <Button
            variant="outline"
            className="mt-4 text-md w-full p-6 bg-gray-100"
            onClick={async () => {
              await handleCopyLink();
              onInviteSuccess();
              setIsSearchOpen(false);
            }}
          >
            <Link className="mr-3 h-7 w-7" />
            Copy Invite Link
          </Button>
          <Divider text="OR" />
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
