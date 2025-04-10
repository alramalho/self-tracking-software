import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useUpgrade } from "@/contexts/UpgradeContext";

interface GenericLoaderProps {
  message?: string;
  showServerMessage?: boolean;
  showBugMessage?: boolean;
  onReportBug?: () => void;
}

export default function GenericLoader({
  message = "Loading your data...",
  showServerMessage = false,
  showBugMessage = false,
  onReportBug,
}: GenericLoaderProps) {
  const { setShowUpgradePopover } = useUpgrade();

  return (
    <div className="flex flex-row items-center">
      <Loader2 className="w-10 h-10 animate-spin mr-3" />
      <div className="flex flex-col items-start">
        <p className="text-left">{message}</p>
        {showServerMessage && (
          <>
            <p className="text-gray-500 text-sm text-left mt-2">
              we run on cheap servers...
            </p>
            <p className="text-gray-500 text-sm text-left">
              consider{" "}
              <Link
                target="_blank"
                href="https://ko-fi.com/alexramalho"
                className="underline"
              >
                donating
              </Link>{" "}
              or{" "}
              <span
                className="underline cursor-pointer"
                onClick={() => setShowUpgradePopover(true)}
              >
                upgrading{" "}
              </span>
            </p>
            <p className="text-gray-500 text-sm text-left">
              to support server upgrades 🙇‍♂️
            </p>
          </>
        )}
        {showBugMessage && (
          <span className="text-gray-500 text-sm text-left mt-2">
            okay this is weird... <br />
            <span
              className="underline cursor-pointer"
              onClick={onReportBug}
            >
              you may get in contact now
            </span>
          </span>
        )}
      </div>
    </div>
  );
} 