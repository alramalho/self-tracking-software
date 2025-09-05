"use client";

import { useGlobalDataOperations } from "@/contexts/GlobalDataProvider";
import { useCurrentUser } from "@/contexts/users";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useNotifications } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";
import { useSession } from "@clerk/nextjs";
import { usePathname, useRouter } from "next/navigation";
import posthog from "posthog-js";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import Lottie from "react-lottie";
import targetAnimation from "../../public/animations/target.lottie.json";
import BottomNav from "./BottomNav";
import FeedbackForm from "./FeedbackForm";
import { BarProgressLoader } from "./ui/BarProgressLoader";

export default function GeneralInitializer({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isSignedIn, isLoaded: isClerkLoaded } = useSession();
  const { currentUser, hasLoadedUserData, updateUser } = useCurrentUser();
  const { isAppInstalled, isPushGranted } = useNotifications();
  const { refetchAllData } = useGlobalDataOperations();
  const [hasRanPosthogIdentify, setHasRanPosthogIdentify] = useState(false);
  const [showBugDialog, setShowBugDialog] = useState(false);
  const pathname = usePathname();
  const isDesktop = useMediaQuery("(min-width: 768px)");
    const router = useRouter();

  const email = currentUser?.email || "";
  const isOnboardingPage = pathname.startsWith("/onboarding");

  useEffect(() => {
    if (
      isClerkLoaded &&
      isSignedIn &&
      hasLoadedUserData &&
      currentUser?.onboardingCompletedAt == null 
      && !isOnboardingPage
    ) {
      console.log("pushing")
      router.push("/onboarding");
    }
  }, [currentUser, router, isClerkLoaded, isSignedIn, hasLoadedUserData, pathname, isOnboardingPage]);

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
        refetchAllData();
      }
      if (
        currentUser.timezone !==
        Intl.DateTimeFormat().resolvedOptions().timeZone
      ) {
        updateUser({
          updates: {
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
          muteNotifications: true,
        }).catch((err) => {
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
    (isSignedIn && !hasLoadedUserData) || 
    (isSignedIn && hasLoadedUserData && currentUser?.onboardingCompletedAt == null && !isOnboardingPage)
  ) {
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
        <div className="fixed inset-0 flex flex-col items-center justify-center gap-8">
          <Lottie
            options={{
              loop: true,
              autoplay: true,
              animationData: targetAnimation,
              rendererSettings: {
                preserveAspectRatio: "xMidYMid slice"
              }
            }}
            height={130}
            width={130}
          />
          <BarProgressLoader durationSeconds={20} />
        </div>
      </>
    );
  }

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
