import { useState } from "react";
import { useClipboard } from "./useClipboard";
import { useShare } from "./useShare";
import { toast } from "sonner";
import { useUserPlan } from "@/contexts/UserGlobalContext";

export function useShareOrCopy() {
  const [copied, copyToClipboard] = useClipboard();
  const { share, isSupported: isShareSupported } = useShare();
  const { useTimelineDataQuery, useCurrentUserDataQuery } = useUserPlan();
  const { data: userData } = useCurrentUserDataQuery();

  const shareOrCopyLink = async (link: string) => {
    if (isShareSupported) {
      const success = await share(link);
      if (!success) toast.info("Sharing not carried through");
    } else {
      const success = await copyToClipboard(link);
      if (!success) toast.error("Failed to copy");
      toast.success("Link copied to clipboard");
    }
  };

  const shareOrCopyReferralLink = async () => {
    const link = `https://app.tracking.so/join/${userData?.username}`;

    await shareOrCopyLink(link);
  };

  return { shareOrCopyLink, shareOrCopyReferralLink, isShareSupported };
}
