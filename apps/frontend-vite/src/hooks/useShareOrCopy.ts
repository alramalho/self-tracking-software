import { useCurrentUser } from "@/contexts/users";
import toast from "react-hot-toast";
import { useClipboard } from "./useClipboard";
import { useShare } from "./useShare";

export function useShareOrCopy() {
  const [_, copyToClipboard] = useClipboard();
  const { currentUser } = useCurrentUser();
  const { share, isSupported: isShareSupported } = useShare();

  const shareOrCopyLink = async (link: string) => {
    if (isShareSupported) {
      await share(link);
    } else {
      const success = await copyToClipboard(link);
      if (!success) toast.error("Failed to copy");
      toast.success("Link copied to clipboard");
    }
  };

  const shareOrCopyReferralLink = async () => {
    const link = `https://app.tracking.so/join/${currentUser?.username}`;

    await shareOrCopyLink(link);
  };

  const copyLink = async (link: string) => {
    const success = await copyToClipboard(link);
    if (!success) toast.error("Failed to copy");
    toast.success("Link copied to clipboard");
  };

  return {
    shareOrCopyLink,
    shareOrCopyReferralLink,
    copyLink,
    isShareSupported,
  };
}
