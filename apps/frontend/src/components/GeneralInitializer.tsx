"use client";

import { useOnboardingCompleted } from "@/app/onboarding/components/OnboardingContext";
import { hasCachedUserData, useUserPlan } from "@/contexts/UserGlobalContext";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useNotifications } from "@/hooks/useNotifications";
import { usePaidPlan } from "@/hooks/usePaidPlan";
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
  const { useCurrentUserDataQuery, hasLoadedUserData, isWaitingForData } =
    useUserPlan();
  const currentUserDataQuery = useCurrentUserDataQuery();
  const { data: userData } = currentUserDataQuery;
  const { isAppInstalled, isPushGranted } = useNotifications();
  const [hasRanPosthogIdentify, setHasRanPosthogIdentify] = useState(false);
  const [showBugDialog, setShowBugDialog] = useState(false);
  const pathname = usePathname();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [initialCacheExists] = useState(() => hasCachedUserData());
  const hasFriends =
    userData?.friends?.length &&
    userData?.friends?.length > 0;
  const { userPlanType: userPaidPlanType } = usePaidPlan();
  const router = useRouter();
  const { isOnboardingCompleted } = useOnboardingCompleted();
  const { isUserFree } = usePaidPlan();

  const onboardingNecessary = useMemo(
    () => !isWaitingForData && !hasFriends && isUserFree && !isOnboardingCompleted,
    [isWaitingForData, hasFriends, userPaidPlanType, isOnboardingCompleted]
  );

  const email = userData?.email || "";

  useEffect(() => {
    if (onboardingNecessary) {
      router.push("/onboarding");
    }
  }, [onboardingNecessary, router]);

  useEffect(() => {
    if (
      isSignedIn &&
      hasLoadedUserData &&
      userData &&
      !hasRanPosthogIdentify
    ) {
      posthog.identify(userData.id, {
        email: userData.email,
        name: userData.name,
        username: userData.username,
        is_app_installed: isAppInstalled,
        is_looking_for_ap: userData.lookingForAp,
        is_push_granted: isPushGranted,
      });
      setHasRanPosthogIdentify(true);
    }
  }, [
    isSignedIn,
    hasLoadedUserData,
    userData,
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
    (isSignedIn && isWaitingForData && !initialCacheExists)
  ) {
    console.log("showGenericLoader", {isClerkLoaded, isSignedIn, isWaitingForData, initialCacheExists});
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
