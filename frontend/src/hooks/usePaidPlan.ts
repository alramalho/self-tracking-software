import { useFeatureFlagEnabled } from "posthog-js/react";
import { useEffect, useState } from "react";

export type PaidPlanType = "plus" | "supporter" | "free";

const PLAN_LIMITS = {
  free: {
    maxMetrics: 1,
  },
  plus: {
    maxMetrics: 5,
  },
  supporter: {
    maxMetrics: 20,
  },
} as const;

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
    maxMetrics: PLAN_LIMITS[userPaidPlanType].maxMetrics,
  };
}
