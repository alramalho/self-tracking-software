import { useCurrentUser } from "@/contexts/users";
import toast from "react-hot-toast";
import { useClipboard } from "./useClipboard";
import { useShare } from "./useShare";

export function useShareOrCopy() {
  const [copied, copyToClipboard] = useClipboard();
  const { share, isSupported: isShareSupported } = useShare();
  const { currentUser } = useCurrentUser();

  const shareOrCopyLink = async (link: string) => {
    if (isShareSupported) {
      const success = await share(link);
      if (!success) toast("Sharing not carried through");
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

  return { shareOrCopyLink, shareOrCopyReferralLink, isShareSupported };
}
