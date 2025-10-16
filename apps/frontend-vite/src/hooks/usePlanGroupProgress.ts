import { useQuery } from "@tanstack/react-query";
import { useApiWithAuth } from "@/api";
import { getPlanGroupProgress, type PlanGroupProgressData } from "@/contexts/plans/service";

export const usePlanGroupProgress = (planId: string | null) => {
  const api = useApiWithAuth();

  return useQuery({
    queryKey: ["plan-group-progress", planId],
    queryFn: async () => {
      if (!planId) return null;
      return await getPlanGroupProgress(api, planId);
    },
    enabled: !!planId,
    staleTime: 1000 * 60, // 1 minute
  });
};
