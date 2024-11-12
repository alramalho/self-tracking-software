"use client";

import { useEffect, useState } from "react";
import posthog from "posthog-js";
import { useUserPlan } from "@/contexts/UserPlanContext";
import { useSession } from "@clerk/nextjs";
import { useNotifications } from "@/hooks/useNotifications";
import AppNotInstalledPage from "./AppNotInstalledPage";

export default function GeneralInitializer() {

  const { isSignedIn } = useSession();
  const { useUserDataQuery, hasLoadedUserData } = useUserPlan();
  const { data: userData } = useUserDataQuery("me");
  const { isAppInstalled, isPushGranted } = useNotifications();
  const [hasRan, setHasRan] = useState(false);


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

  if (!isAppInstalled) {
    return <AppNotInstalledPage />;
  }

  return <></>;
}
