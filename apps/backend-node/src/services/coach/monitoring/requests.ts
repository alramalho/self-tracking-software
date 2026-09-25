import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import type { CoachNudge } from "@tsw/prisma/follow-through";
import { changeState } from "../../follow-through/store";
import { FollowThroughInputError } from "../../follow-through/errors";
import { executePlanProposalPatch } from "../../planProposalPatchService";
import { prisma } from "../../../utils/prisma";
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

/**
 * The two buttons on a silent nudge. "remind" books one push for tomorrow at the plan's reminder
 * time (and lifts any pause on the plan); "archive" archives it. Either way the nudge is answered.
 */
export async function answerNudge(
  userId: string,
  messageId: string,
  action: "remind" | "archive",
): Promise<CoachNudge> {
  const message = await prisma.message.findFirst({ where: { id: messageId, chat: { userId } } });
  const nudge = (message?.metadata as { nudge?: CoachNudge } | null)?.nudge;
  if (!message || !nudge) throw new FollowThroughInputError("This suggestion is no longer available.");
  if (nudge.outcome) return nudge;

  if (action === "archive")
    await executePlanProposalPatch({ planId: nudge.planId, userId, patch: { archive: true } });

  let answered: CoachNudge = { ...nudge, outcome: action };
  await changeState(userId, async (state, tx) => {
    const monitoring = (state.monitoring ??= monitoringState());
    if (action === "remind") {
      const support = state.supports[nudge.planId];
      const timezone = support?.timezone || "UTC";
      const tomorrow = formatInTimeZone(new Date(Date.now() + 86400000), timezone, "yyyy-MM-dd");
      const remindAt = fromZonedTime(
        `${tomorrow}T${support?.preferences.dayReminderTime ?? "09:00"}:00`,
        timezone,
      ).toISOString();
      monitoring.reminders = [
        ...(monitoring.reminders ?? []).filter((r) => r.planId !== nudge.planId || r.sentAt),
        { planId: nudge.planId, dueAt: remindAt },
      ];
      monitoring.pausedPlanIds = monitoring.pausedPlanIds.filter((id) => id !== nudge.planId);
      monitoring.lapsePlanIds = monitoring.lapsePlanIds?.filter((id) => id !== nudge.planId);
      answered = { ...answered, remindAt };
    }
    for (const request of monitoring.requests)
      if (request.messageId === messageId && !request.resolvedAt && !request.closedAt)
        request.resolvedAt = new Date().toISOString();
    await tx.message.update({
      where: { id: messageId },
      data: { metadata: { ...(message.metadata as object), nudge: { ...answered } } },
    });
  });
  return answered;
}
