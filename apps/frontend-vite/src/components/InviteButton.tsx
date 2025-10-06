import { useApiWithAuth } from "@/api";
import { Button } from "@/components/ui/button";
import { useShareOrCopy } from "@/hooks/useShareOrCopy";
import { Link, Share, UserPlus } from "lucide-react";
import React, { useState } from "react";
import { toast } from "react-hot-toast";
import AppleLikePopover from "./AppleLikePopover";
import Divider from "./Divider";
import UserSearch, { type UserSearchResult } from "./UserSearch";

interface InviteButtonProps {
  planId: string;
  onInviteSuccess: () => void;
}

const InviteButton: React.FC<InviteButtonProps> = ({
  planId,
  onInviteSuccess,
}) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [invitees, setInvitees] = useState<UserSearchResult[]>([]);
  const api = useApiWithAuth();
  const { shareOrCopyLink, isShareSupported } = useShareOrCopy();

  const handleUserSelect = (user: UserSearchResult) => {
    if (!invitees.some((invitee) => invitee.userId === user.userId)) {
      setInvitees([...invitees, user]);
    }
  };

  const removeInvitee = (userIdToRemove: string) => {
    setInvitees(
      invitees.filter((invitee) => invitee.userId !== userIdToRemove)
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
          api.post(`/invite-to-plan/${planId}/${invitee.userId}`)
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
        await shareOrCopyLink(link);

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
      className="mt-4 text-md w-full p-6 bg-gray-50"
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

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          setIsSearchOpen(!isSearchOpen);
        }}
        className={`p-0`}
      >
        <UserPlus className="h-5 w-5" />
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
          Invite ({invitees.length})
        </Button>
      </AppleLikePopover>
    </>
  );
};

export default InviteButton;
