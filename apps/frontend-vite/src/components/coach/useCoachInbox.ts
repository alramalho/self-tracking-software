import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { coachItems } from "@tsw/prisma/follow-through/coach-inbox";
import { useApiWithAuth } from "@/api";
import { getCoachAttentionItems } from "@/contexts/ai/service";
import { useActivities } from "@/contexts/activities/useActivities";
import { useMetrics } from "@/contexts/metrics";
import { usePlans } from "@/contexts/plans";
import { answeredMissedWeek } from "./missReasons";
import { useFollowThrough } from "./useCoaching";

/** Everything the coach is waiting on you for: the Coach tab's Recent list and the tab's count. */
export function useCoachInbox() {
  const api = useApiWithAuth();
  const { plans, isLoadingPlans } = usePlans();
  const { activityEntries } = useActivities();
  const { metrics, entries: metricEntries } = useMetrics();
  const followThrough = useFollowThrough();
  const attention = useQuery({
    queryKey: ["coach-attention"],
    queryFn: () => getCoachAttentionItems(api),
    staleTime: 60_000,
  });
  const items = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    const checkedInToday = (metrics ?? []).every((metric) =>
      (metricEntries ?? []).some(
        (entry) =>
          entry.metricId === metric.id &&
          new Date(entry.createdAt).toISOString().slice(0, 10) === today &&
          (entry.rating > 0 || entry.skipped),
      ),
    );
    return coachItems({
      plans: plans ?? [],
      entries: activityEntries ?? [],
      state: followThrough.data?.state,
      attention: attention.data ?? [],
      metrics: metrics ?? [],
      checkedInToday,
      answeredMisses: (plans ?? []).map((p) => p.id).filter(answeredMissedWeek),
    });
  }, [plans, activityEntries, followThrough.data, attention.data, metrics, metricEntries]);
  return {
    items,
    pendingCount: items.length,
    loading: isLoadingPlans || followThrough.isPending,
    error: followThrough.error,
  };
}
