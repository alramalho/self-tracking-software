import { useEffect, useRef } from "react";
import { router, usePathname } from "expo-router";
import { useCurrentUser, usePlans } from "@/data/queries";
import { useSession } from "@/auth/provider";
export function OnboardingGate() {
  const auth = useSession(),
    user = useCurrentUser(auth.isSignedIn),
    plans = usePlans(auth.isSignedIn),
    path = usePathname(),
    shown = useRef(false);
  useEffect(() => {
    if (!auth.isSignedIn || !user.data || !plans.data || shown.current) return;
    if (user.data.onboardingCompletedAt || plans.data.length) return;
    if (path !== "/" && path !== "/index") return;
    shown.current = true;
    router.push("/onboarding" as never);
  }, [auth.isSignedIn, user.data, plans.data, path]);
  return null;
}
