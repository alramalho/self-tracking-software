"use client";

import { useEffect, useState } from "react";
import posthog from "posthog-js";
import { useUserPlan } from "@/contexts/UserPlanContext";
import { useNotifications } from "@/hooks/useNotifications";
import { useOfflineAuth } from "@/hooks/useOfflineAuth";
import BottomNav from "./BottomNav";
import { Loader2 } from "lucide-react";
import FeedbackForm from "./FeedbackForm";
import { toast } from "react-hot-toast";
import GenericLoader from "./GenericLoader";
import { useThemeColors } from "@/hooks/useThemeColors";
import { getThemeVariants } from "@/utils/theme";

export default function GeneralInitializer({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isSignedIn, isLoaded, isOnline, hasValidCache } = useOfflineAuth();
  const { useCurrentUserDataQuery, hasLoadedUserData, isWaitingForData } = useUserPlan();
  const currentUserDataQuery = useCurrentUserDataQuery();
  const { data: userData } = currentUserDataQuery;
  const { isAppInstalled, isPushGranted } = useNotifications();
  const [hasRanPosthogIdentify, setHasRanPosthogIdentify] = useState(false);
  const [showBugDialog, setShowBugDialog] = useState(false);
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);

  const email = userData?.user?.email || "";

  useEffect(() => {
    if (isSignedIn && hasLoadedUserData && userData?.user && !hasRanPosthogIdentify) {
      posthog.identify(userData?.user.id, {
        email: userData?.user.email,
        name: userData?.user.name,
        username: userData?.user.username,
        is_app_installed: isAppInstalled,
        is_looking_for_ap: userData?.user.looking_for_ap,
        is_push_granted: isPushGranted,
      });
      setHasRanPosthogIdentify(true);
    }
  }, [isSignedIn, hasLoadedUserData, userData, hasRanPosthogIdentify, isAppInstalled, isPushGranted]);

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

  // Show loading screen if:
  // 1. Auth isn't loaded yet
  // 2. User is signed in but waiting for data AND no valid cache exists
  if (isOnline && !isLoaded || (isSignedIn && isWaitingForData && !hasValidCache)) {
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
            onReportBug={() => setShowBugDialog(true)}
          />
        </div>
      </>
    );
  }

  return (
    <>
      {/* Offline indicator */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 bg-gray-500 text-white text-center py-2 text-sm z-50">
          📱 You&apos;re offline - you may still log activities
        </div>
      )}
      
      {children}
      {isSignedIn && <BottomNav />}
      
      {/* Show a mini loader if user is signed in and main user data is actively loading, 
          even if we are showing children due to initially existing cache. */}
      {isSignedIn && isWaitingForData && (
        <div className="fixed bottom-[6.5rem] left-4 bg-white dark:bg-gray-900 p-2 rounded-full shadow-md z-50">
          <Loader2 className={`h-6 w-6 animate-spin ${variants.text}`} />
        </div>
      )}
    </>
  );
}
