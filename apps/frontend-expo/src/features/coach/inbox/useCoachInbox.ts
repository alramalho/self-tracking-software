import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/data/api";
import { dayKey } from "@/core/dates";
import { useEntries, useMetricEntries, useMetrics, usePlans } from "@/data/queries";
import { useFollowThrough } from "@/features/follow-through/api";
import { answeredOnServer } from "@/features/timeline/home-cards/miss-reasons";
import type { CoachAttentionItem } from "@/features/messages/types";
import { coachItems } from "../model";

/** Everything the coach is waiting on you for: the Coach tab's Recent list and the tab's badge. */
export function useCoachInbox() {
  const plans = usePlans();
  const entries = useEntries();
  const followThrough = useFollowThrough();
  const metrics = useMetrics();
  const metricEntries = useMetricEntries();
  const attention = useQuery({
    queryKey: ["coach-attention"],
    queryFn: async () =>
      (await api.get<{ attentionItems: CoachAttentionItem[] }>("/ai/coach/attention")).data.attentionItems,
    staleTime: 60000,
  });
  const planIds = (plans.data ?? []).map((p) => p.id).join(",");
  const items = useMemo(() => {
    const today = dayKey(new Date());
    const checkedInToday = (metrics.data ?? []).every((metric) =>
      (metricEntries.data ?? []).some(
        (entry) =>
          entry.metricId === metric.id &&
          new Date(entry.createdAt).toISOString().slice(0, 10) === today &&
          (entry.rating > 0 || entry.skipped),
      ),
    );
    return coachItems({
      plans: plans.data ?? [],
      entries: entries.data ?? [],
      state: followThrough.data?.state,
      attention: attention.data ?? [],
      metrics: metrics.data ?? [],
      checkedInToday,
      // A missed week is asked about once: finishing Talk to coach answers it on the server.
      answeredMisses: (plans.data ?? []).map((p) => p.id).filter((id) => answeredOnServer(followThrough.data?.state, id)),
    });
  }, [plans.data, entries.data, followThrough.data, attention.data, metrics.data, metricEntries.data]);
  return {
    items,
    pendingCount: items.length,
    loading: plans.isPending || followThrough.isPending,
    error: plans.error ?? followThrough.error,
  };
}
