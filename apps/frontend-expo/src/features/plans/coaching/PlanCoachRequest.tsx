import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/data/api";
import type { GroupedRow } from "@/components/types";
import type { Message } from "@/features/messages/types";
import type { Plan } from "@/core/types";
import { useFollowThrough } from "@/features/follow-through/api";

/** The coach's open change or question for this plan, as a row that opens it in Messages. */
export function usePlanCoachRequest(plan: Plan, enabled: boolean): GroupedRow | null {
  const followThrough = useFollowThrough();
  const query = useQuery({
    queryKey: ["plan-coach-action-messages", plan.id],
    queryFn: async () =>
      (
        await api.get<{ messages: Message[] }>(
          `/plans/${plan.id}/coach-action-messages`,
        )
      ).data,
    staleTime: 15000,
    enabled,
  });
  if (!enabled) return null;
  const message = query.data?.messages?.find((m) =>
    m.planProposals?.some((p) => p.planId === plan.id && !p.status),
  );
  const monitoring = followThrough.data?.state.monitoring;
  const request = monitoring?.requests.find(
    (r) =>
      r.planIds.includes(plan.id) &&
      r.requiresReply &&
      !r.closedAt &&
      !r.resolvedAt,
  );
  const chatId = message?.chatId ?? request?.chatId;
  const messageId = message?.id ?? request?.messageId;
  if (chatId && messageId)
    return {
      id: "coach-request",
      icon: "💬",
      title: "Coach",
      value: message ? "A change to review" : "A question for you",
      attention: true,
      onPress: () =>
        router.push({
          pathname: "/chat/[id]",
          params: { id: chatId, planId: plan.id, messageId, type: "COACH" },
        }),
    };
  if (monitoring?.setupPlanIds?.includes(plan.id))
    return {
      id: "coach-request",
      icon: "⏳",
      title: "Coach",
      value: "Preparing your first week",
      disabled: true,
    };
  return null;
}
