import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Link, Share, UserPlus } from "lucide-react";
import UserSearch, { UserSearchResult } from "./UserSearch";
import { useApiWithAuth } from "@/api";
import { toast } from "react-hot-toast";
import AppleLikePopover from "./AppleLikePopover";
import Divider from "./Divider";
import { useClipboard } from "@/hooks/useClipboard";
import { useShare } from "@/hooks/useShare";

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
  const [copied, copyToClipboard] = useClipboard();
  const { share, isSupported: isShareSupported } = useShare();

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

  const handleShareOrCopy = async () => {
    toast.promise(
      (async () => {
        const link = await generateCopyLink();

        if (isShareSupported) {
          const success = await share(link);
          if (!success) throw new Error("Failed to share");
        } else {
          const success = await copyToClipboard(link);
          if (!success) throw new Error("Failed to copy");
        }

        onInviteSuccess();
        setIsSearchOpen(false);
        return isShareSupported
          ? "Shared invite link"
          : "Copied invite link to clipboard";
      })(),
      {
        loading: "Generating invite link...",
        success: (message) => message,
        error: isShareSupported
          ? "Failed to share invite link"
          : "Failed to copy invite link",
      }
    );
  };

  const shareOrCopyButton = (
    <Button
      variant="outline"
      className="mt-4 text-md w-full p-6 bg-gray-100"
      onClick={handleShareOrCopy}
    >
      {isShareSupported ? (
        <>
          <Share className="mr-3 h-7 w-7" />
          <span className="text-sm">Share Invite</span>
        </>
      ) : (
        <>
          <Link className="mr-3 h-7 w-7" />
          <span className="text-sm">Copy Invite Link</span>
        </>
      )}
    </Button>
  );

  if (embedded) {
    return (
      <>
        {shareOrCopyButton}
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
      <AppleLikePopover
        open={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      >
        {shareOrCopyButton}
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
    </div>
  );
};

export default InviteButton;
