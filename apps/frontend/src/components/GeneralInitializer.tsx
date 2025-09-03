"use client";

import { useGlobalDataOperations } from "@/contexts/GlobalDataProvider";
import { useCurrentUser } from "@/contexts/users";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useNotifications } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";
import { useSession } from "@clerk/nextjs";
import { usePathname, useRouter } from "next/navigation";
import posthog from "posthog-js";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import BottomNav from "./BottomNav";
import FeedbackForm from "./FeedbackForm";
import GenericLoader from "./GenericLoader";

export default function GeneralInitializer({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isSignedIn, isLoaded: isClerkLoaded } = useSession();
  const { currentUser, hasLoadedUserData, updateUser } = useCurrentUser();
  const { isAppInstalled, isPushGranted } = useNotifications();
  const [hasRanPosthogIdentify, setHasRanPosthogIdentify] = useState(false);
  const [showBugDialog, setShowBugDialog] = useState(false);
  const pathname = usePathname();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const { hasCacheData } = useGlobalDataOperations();
  const [initialCacheExists] = useState(() => hasCacheData());
  const router = useRouter();
  const isOnboardingCompleted = currentUser?.onboardingCompletedAt != null;

  const onboardingNecessary = useMemo(() => {
    return hasLoadedUserData && !isOnboardingCompleted;
  }, [isOnboardingCompleted]);

  const email = currentUser?.email || "";

  useEffect(() => {
    if (onboardingNecessary) {
      router.push("/onboarding");
    }
  }, [onboardingNecessary, router]);

  useEffect(() => {
    if (isSignedIn && hasLoadedUserData && currentUser) {
      if (!hasRanPosthogIdentify) {
        posthog.identify(currentUser.id, {
          email: currentUser.email,
          name: currentUser.name,
          username: currentUser.username,
          is_app_installed: isAppInstalled,
          is_looking_for_ap: currentUser.lookingForAp,
          friend_count: currentUser.friends?.length,
          is_push_granted: isPushGranted,
        });
        setHasRanPosthogIdentify(true);
      }
      if (currentUser.timezone !== Intl.DateTimeFormat().resolvedOptions().timeZone) {
        updateUser({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }).catch((err) => {
          console.error("Failed to update timezone on initial load:", err);
        });
      }
    }
  }, [
    isSignedIn,
    hasLoadedUserData,
    currentUser,
    hasRanPosthogIdentify,
    isAppInstalled,
    isPushGranted,
  ]);

  const reportBug = async (text: string, email: string) => {
    await toast.promise(
      fetch("/api/report-bug", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
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

  if (
    !isClerkLoaded ||
    (isSignedIn && hasLoadedUserData && !initialCacheExists)
  ) {
    console.log("showGenericLoader", {
      isClerkLoaded,
      isSignedIn,
      initialCacheExists,
    });
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
          <GenericLoader onReportBug={() => setShowBugDialog(true)} />
        </div>
      </>
    );
  }
  const isOnboardingPage = pathname.startsWith("/onboarding");

  return (
    <>
      {isOnboardingPage ? (
        children
      ) : (
        <>
          <div
            className={cn(
              "absolute inset-0 overflow-auto",
              isSignedIn && !isDesktop ? "pb-[4.7rem]" : "",
              isSignedIn && isDesktop ? "left-0" : ""
            )}
          >
            {children}
          </div>
          {isSignedIn && <BottomNav />}
        </>
      )}
    </>
  );
}
