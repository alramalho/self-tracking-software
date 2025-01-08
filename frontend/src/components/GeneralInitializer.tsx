"use client";

import { useEffect, useState } from "react";
import posthog from "posthog-js";
import { useUserPlan } from "@/contexts/UserPlanContext";
import { useSession } from "@clerk/nextjs";
import { useNotifications } from "@/hooks/useNotifications";
import AppNotInstalledPage from "./AppNotInstalledPage";
import BottomNav from "./BottomNav";
import { Link, Loader2 } from "lucide-react";

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

  const [showServerMessage, setShowServerMessage] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowServerMessage(true);
    }, 4000);

    return () => clearTimeout(timer);
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

  if (!isAppInstalled && process.env.NEXT_PUBLIC_ENVIRONMENT !== "development") {
    return <AppNotInstalledPage />;
  }


  if (!isLoaded || !hasLoadedUserData) {
    return (
      <div className="h-screen flex items-center justify-center">
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
        </div>
      </div>
    );
  }

  return (
    <>
      {children}
      {isSignedIn && <BottomNav />}
    </>
  );
}
