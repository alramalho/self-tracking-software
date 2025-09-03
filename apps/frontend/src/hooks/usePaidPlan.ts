import { useCurrentUser } from "@/contexts/users";

export type PaidPlanType = "PLUS" | "FREE";

const PLAN_LIMITS = {
  FREE: {
    maxPlans: 1,
    maxMetrics: 0,
  },
  PLUS: {
    maxPlans: 100,
    maxMetrics: 5,
  },
} as const;

export function usePaidPlan() {
  const { currentUser } = useCurrentUser();

  return {
    isUserFree: currentUser?.planType === "FREE",
    isUserPremium: currentUser?.planType === "PLUS",
    userPlanType: currentUser?.planType,
    maxMetrics: PLAN_LIMITS[currentUser?.planType || "FREE"].maxMetrics,
    maxPlans: PLAN_LIMITS[currentUser?.planType || "FREE"].maxPlans,
  };
}
