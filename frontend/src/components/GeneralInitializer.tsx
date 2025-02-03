"use client";

import { useEffect, useState } from "react";
import posthog from "posthog-js";
import { useUserPlan } from "@/contexts/UserPlanContext";
import { useSession } from "@clerk/nextjs";
import { useNotifications } from "@/hooks/useNotifications";
import AppNotInstalledPage from "./AppNotInstalledPage";
import BottomNav from "./BottomNav";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import FeedbackForm from "./FeedbackForm";
import { toast } from "react-hot-toast";
import { useApiWithAuth } from "@/api";

export default function GeneralInitializer({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isSignedIn, isLoaded } = useSession();
  const { useUserDataQuery, hasLoadedUserData } = useUserPlan();
  const { data: userData } = useUserDataQuery("me");
  const { isAppInstalled, isPushGranted } = useNotifications();
  const [hasRan, setHasRan] = useState(false);
  const [isAppInstallModalClosed, setIsAppInstallModalClosed] = useState(false);

  const [showServerMessage, setShowServerMessage] = useState(false);
  const [showBugMessage, setShowBugMessage] = useState(false);
  const [showBugDialog, setShowBugDialog] = useState(false);
  const api = useApiWithAuth();

  const email = userData?.user?.email || "";

  const reportBug = async (text: string) => {
    await toast.promise(
      api.post("/report-feedback", {
        email,
        text,
        type: "bug_report",
      }),
      {
        loading: "Sending bug report...",
        success: "Bug report sent successfully!",
        error: "Failed to send bug report",
      }
    );
  };

  useEffect(() => {
    const timer1 = setTimeout(() => {
      setShowServerMessage(true);
    }, 4000);
    const timer2 = setTimeout(() => {
      setShowBugMessage(true);
    }, 16000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

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

  if (
    !isAppInstalled &&
    isSignedIn &&
    !isAppInstallModalClosed &&
    process.env.NEXT_PUBLIC_ENVIRONMENT !== "development"
  ) {
    return (
      <AppNotInstalledPage onClose={() => setIsAppInstallModalClosed(true)} />
    );
  }

  if (!isLoaded || (isSignedIn && !hasLoadedUserData)) {
    return (
      <>
        {showBugDialog && (
          <FeedbackForm
            title="🐞 Report a Bug"
            email={email}
            placeholder="Please describe the bug you encountered..."
            onSubmit={reportBug}
            onClose={() => setShowBugDialog(false)}
          />
        )}
        <div className="fixed inset-0 flex items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin mr-3" />
          <div className="flex flex-col items-start">
            <p className="text-left">Loading your data...</p>
            {showServerMessage && (
              <span className="text-gray-500 text-sm text-left">
                we run on cheap servers...
                <br />
                <Link
                  target="_blank"
                  href="https://ko-fi.com/alexramalho"
                  className="underline"
                >
                  donate?
                </Link>
              </span>
            )}
            {showBugMessage && (
              <span className="text-gray-500 text-sm text-left">
                okay this is weird... <br />
                <span
                  className="underline cursor-pointer"
                  onClick={() => setShowBugDialog(true)}
                >
                  you may get in contact now
                </span>
              </span>
            )}
          </div>
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
