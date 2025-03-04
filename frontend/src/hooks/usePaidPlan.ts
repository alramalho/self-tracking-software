import { useApiWithAuth } from "@/api";
import { useUserPlan } from "@/contexts/UserPlanContext";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

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
  const { useCurrentUserDataQuery } = useUserPlan();
  const { data: userData } = useCurrentUserDataQuery();
  const api = useApiWithAuth();

  const useUserPlanType = (username: string) =>
    useQuery({
      queryKey: ["userPlanType", username],
      queryFn: async () => {
        const { data } = await api.get<{ plan_type: PaidPlanType }>(
          `/${username}/get-user-plan-type`
        );
        return data.plan_type;
      },
      enabled: !!username,
    });

  return {
    useUserPlanType,
    userPaidPlanType: userData?.user?.plan_type,
    maxMetrics: PLAN_LIMITS[userData?.user?.plan_type || "free"].maxMetrics,
  };
}
