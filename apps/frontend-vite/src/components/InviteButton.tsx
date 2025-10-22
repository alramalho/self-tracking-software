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
  isExternalSupported: boolean;
  planEmoji?: string;
  planGoal?: string;
}

const InviteButton: React.FC<InviteButtonProps> = ({
  planId,
  onInviteSuccess,
  isExternalSupported = true,
  planEmoji,
  planGoal,
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
          api.post(`/plans/invite-to-plan`, {
            planId,
            recipientId: invitee.userId,
          })
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
      className="mt-4 text-md w-full p-6 bg-muted"
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
        title="Invite to Plan"
      >
        {planEmoji && planGoal && (
          <div className="text-center mb-6 mt-4">
            <div className="text-6xl mb-3">
              {planEmoji}
            </div>
            <h3 className="text-lg font-semibold">
              {planGoal}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Invite people to join this plan
            </p>
          </div>
        )}
        {isExternalSupported && shareOrCopyButton}
        {isExternalSupported && <Divider text="OR" />}
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
