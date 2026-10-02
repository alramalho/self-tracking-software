import { changeState } from "../../follow-through/store";
import type { Message } from "@tsw/prisma";
import { monitoringState } from "./model";
import type { MonitoringMessageMetadata } from "./types";

/** Continue following a question asked after the person replies to a scheduled message. */
export async function recordCoachRequests(userId: string, messages: Message[]) {
  await changeState(userId, async (state, tx) => {
    const designedPlanIds = messages.flatMap((message) => {
      const metadata = message.metadata as MonitoringMessageMetadata | null;
      return (metadata?.planProposals ?? [])
        .filter((proposal) => proposal.planId && proposal.patch?.sessions?.upsert?.length)
        .map((proposal) => proposal.planId!);
    });
    if (designedPlanIds.length && state.monitoring?.setupPlanIds)
      state.monitoring.setupPlanIds = state.monitoring.setupPlanIds.filter(
        (id) => !designedPlanIds.includes(id),
      );
    const relevant = messages.filter((m) => {
      const metadata = m.metadata as MonitoringMessageMetadata | null;
      return (
        metadata?.requiresReply ||
        metadata?.planProposals?.some((p) => !p.status)
      );
    });
    if (!relevant.length) return;
    const planIds = [
      ...new Set(
        relevant.flatMap((m) => {
          const metadata = m.metadata as MonitoringMessageMetadata | null;
          return [
            ...(m.planId ? [m.planId] : []),
            ...(metadata?.planProposals
              ?.map((p) => p.planId)
              .filter((id): id is string => !!id) ?? []),
          ];
        }),
      ),
    ].filter(
      (id) =>
        state.supports[id]?.coaching &&
        state.supports[id].coaching!.role !== "tracking",
    );
    if (!planIds.length) return;
    state.monitoring ??= monitoringState();
    const last = relevant[relevant.length - 1],
      id = `conversation:${last.id}`;
    if (state.monitoring.requests.some((r) => r.id === id)) return;
    for (const m of relevant) {
      const metadata = {
        ...(m.metadata as object),
        coachRequestId: id,
        planIds,
      };
      await tx.message.update({ where: { id: m.id }, data: { metadata } });
      m.metadata = metadata;
    }
    state.monitoring.requests.push({
      id,
      kind: "conversation",
      planIds,
      chatId: last.chatId,
      messageId: last.id,
      createdAt: last.createdAt.toISOString(),
      requiresReply: true,
    });
    state.monitoring.requests = state.monitoring.requests
      .filter(
        (r) =>
          (!r.resolvedAt && !r.closedAt) ||
          Date.parse(r.createdAt) > Date.now() - 90 * 86400000,
      )
      .slice(-200);
  });
}

/** A response progresses the conversation; it never marks an activity complete. */
export async function resolveCoachConversation(
  userId: string,
  planId?: string,
  messageId?: string,
) {
  await changeState(userId, async (state, tx) => {
    const message = messageId
      ? await tx.message.findFirst({
          where: { id: messageId, chat: { userId } },
        })
      : null;
    const metadata = message?.metadata as { coachRequestId?: string } | null;
    for (const request of state.monitoring?.requests ?? []) {
      if (request.resolvedAt || request.closedAt) continue;
      const matches = messageId
        ? request.messageId === messageId ||
          request.id === metadata?.coachRequestId
        : // A reply from the unfiltered "All" thread answers whatever is open.
          !planId || request.planIds.includes(planId);
      if (!matches) continue;
      if (messageId) {
        const group = await tx.message.findMany({
          where: {
            chat: { userId },
            metadata: { path: ["coachRequestId"], equals: request.id },
          },
        });
        const pending = group.some((m) => {
          const data = m.metadata as {
            planProposals?: { status?: string }[];
          } | null;
          return data?.planProposals?.some((p) => !p.status);
        });
        if (pending) continue;
      }
      request.resolvedAt = new Date().toISOString();
      await tx.notification.updateMany({
        where: {
          userId,
          relatedData: { path: ["messageId"], equals: request.messageId ?? "" },
        },
        data: { status: "CONCLUDED", concludedAt: new Date() },
      });
    }
  });
}
