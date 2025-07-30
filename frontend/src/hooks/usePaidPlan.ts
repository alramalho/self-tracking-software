import { useApiWithAuth } from "@/api";
import { useUserPlan } from "@/contexts/UserPlanContext";
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
    userPaidPlanType: userData?.user?.planType,
    maxMetrics: PLAN_LIMITS[userData?.user?.planType || "FREE"].maxMetrics,
    maxPlans: PLAN_LIMITS[userData?.user?.planType || "FREE"].maxPlans,
  };
}
