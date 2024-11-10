"use client";

import { useEffect, useState } from "react";
import posthog from "posthog-js";
import { useUserPlan } from "@/contexts/UserPlanContext";
import { useSession } from "@clerk/nextjs";
import { useNotifications } from "@/hooks/useNotifications";


export default function PosthogInitializer() {
  const { isSignedIn } = useSession();
  const { useUserDataQuery, hasLoadedUserData } = useUserPlan();
  const { data: userData } = useUserDataQuery("me");
  const { isAppInstalled, isPushGranted } = useNotifications();
  const [hasIdentifiedUser, setHasIdentifiedUser] = useState(false);

  useEffect(() => {
    if (isSignedIn && hasLoadedUserData && userData?.user) {
      if (!hasIdentifiedUser) {
        console.log("identified user in posthog ", userData?.user.id);
        posthog.identify(userData?.user.id, {
          email: userData?.user.email,
          name: userData?.user.name,
          username: userData?.user.username,
          is_app_installed: isAppInstalled,
          is_push_granted: isPushGranted,
        });
        setHasIdentifiedUser(true);
      }
    }
  }, [isSignedIn, hasLoadedUserData, userData]);

  return <></>;
}
