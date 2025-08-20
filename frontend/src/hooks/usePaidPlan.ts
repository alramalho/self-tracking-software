import { useApiWithAuth } from "@/api";
import { useUserPlan } from "@/contexts/UserGlobalContext";
import { useQuery } from "@tanstack/react-query";

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
  const { useCurrentUserDataQuery } = useUserPlan();
  const { data: userData } = useCurrentUserDataQuery();

  return {
    isUserFree: userData?.planType === "FREE",
    isUserPremium: userData?.planType === "PLUS",
    userPlanType: userData?.planType,
    maxMetrics: PLAN_LIMITS[userData?.planType || "FREE"].maxMetrics,
    maxPlans: PLAN_LIMITS[userData?.planType || "FREE"].maxPlans,
  };
}
