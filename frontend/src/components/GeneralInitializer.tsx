"use client";

import { useEffect, useState } from "react";
import posthog from "posthog-js";
import { useUserPlan } from "@/contexts/UserPlanContext";
import { useSession } from "@clerk/nextjs";
import { useNotifications } from "@/hooks/useNotifications";
import BottomNav from "./BottomNav";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import FeedbackForm from "./FeedbackForm";
import { toast } from "react-hot-toast";
import { useApiWithAuth } from "@/api";
import { usePathname } from "next/navigation";
import { useUpgrade } from "@/contexts/UpgradeContext";
import GenericLoader from "./GenericLoader";

export default function GeneralInitializer({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isSignedIn, isLoaded } = useSession();
  const { useCurrentUserDataQuery, hasLoadedUserData } = useUserPlan();
  const currentUserDataQuery = useCurrentUserDataQuery();
  const { data: userData } = currentUserDataQuery;
  const { isAppInstalled, isPushGranted } = useNotifications();
  const [hasRan, setHasRan] = useState(false);
  const [showServerMessage, setShowServerMessage] = useState(false);
  const [showBugMessage, setShowBugMessage] = useState(false);
  const [showBugDialog, setShowBugDialog] = useState(false);
  const { setShowUpgradePopover } = useUpgrade();

  const email = userData?.user?.email || "";

  useEffect(() => {
    if (isSignedIn && hasLoadedUserData && userData?.user && !hasRan) {
      posthog.identify(userData?.user.id, {
        email: userData?.user.email,
        name: userData?.user.name,
        username: userData?.user.username,
        is_app_installed: isAppInstalled,
        is_push_granted: isPushGranted,
      });

      setHasRan(true);
    }
  }, [isSignedIn, hasLoadedUserData, userData, hasRan]);

  useEffect(() => {
    const timer1 = setTimeout(() => {
      setShowServerMessage(true);
    }, 4000);
    const timer2 = setTimeout(() => {
      setShowBugMessage(true);
    }, 30000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  const reportBug = async (text: string, email: string) => {
    await toast.promise(
      fetch('/api/report-bug', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, text }),
      }),
      {
        loading: "Sending bug report...",
        success: "Bug report sent successfully!",
        error: "Failed to send bug report",
      }
    );
  };

  if (!isLoaded || (isSignedIn && !hasLoadedUserData)) {
    return (
      <>
        {showBugDialog && (
          <FeedbackForm
            title="🐞 Report a Bug"
            email={email}
            placeholder="Please describe the bug you encountered..."
            onSubmit={(text) => reportBug(text, email)}
            onClose={() => setShowBugDialog(false)}
            isEmailEditable={true}
          />
        )}
        <div className="fixed inset-0 flex items-center justify-center">
          <GenericLoader 
            showServerMessage={showServerMessage}
            showBugMessage={showBugMessage}
            onReportBug={() => setShowBugDialog(true)}
          />
        </div>
      </>
    );
  }

  return (
    <>
      {children}
      {isSignedIn && <BottomNav />}
    </>
  );
}
