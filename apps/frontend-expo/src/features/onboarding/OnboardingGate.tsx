import { useEffect, useRef } from "react";
import { router, usePathname } from "expo-router";
import { useCurrentUser, usePlans } from "@/data/queries";
import { useSession } from "@/auth/provider";
import { aiAllowed } from "@/features/ai-consent/AiConsent";
export function OnboardingGate() {
  const auth = useSession(),
    user = useCurrentUser(auth.isSignedIn),
    plans = usePlans(auth.isSignedIn),
    path = usePathname(),
    shown = useRef(false);
  useEffect(() => {
    if (!auth.isSignedIn || !user.data || !plans.data || shown.current) return;
    if (user.data.onboardingCompletedAt || plans.data.length) return;
    // The onboarding interview needs AI; don't push it on people who said Not now.
    if (user.data.aiConsentDeclinedAt && !aiAllowed(user.data)) return;
    if (path !== "/" && path !== "/index") return;
    shown.current = true;
    router.push("/onboarding" as never);
  }, [auth.isSignedIn, user.data, plans.data, path]);
  return null;
}
