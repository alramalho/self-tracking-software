import { useFeatureFlagEnabled } from "posthog-js/react";
import { useEffect, useState } from "react";

export type PaidPlanType = "plus" | "supporter" | "free";

export function usePaidPlan() {
  const isUserPlusFF = useFeatureFlagEnabled("plus-users");
  const isUserSupporterFF = useFeatureFlagEnabled("supporter-users");
  const posthogFeatureFlagsInitialized = typeof isUserPlusFF !== "undefined";
  const [userPaidPlanType, setUserPaidPlanType] =
    useState<PaidPlanType>("free");

  useEffect(() => {
    if (posthogFeatureFlagsInitialized) {
      setUserPaidPlanType(
        isUserPlusFF ? "plus" : isUserSupporterFF ? "supporter" : "free"
      );
    }
  }, [posthogFeatureFlagsInitialized, isUserPlusFF, isUserSupporterFF]);

  return {
    userPaidPlanType,
    posthogFeatureFlagsInitialized,
  };
}
