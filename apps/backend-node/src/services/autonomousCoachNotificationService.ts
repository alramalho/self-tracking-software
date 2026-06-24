import { prisma } from "../utils/prisma";
import { logger } from "../utils/logger";

export const AUTONOMOUS_COACH_PROMPT_TAG = "autonomous_coach";

// A coach message still has work the user hasn't resolved (a pending proposal).
// Such notifications must NOT be auto-concluded on read.
export function hasPendingCoachActions(metadata: unknown): boolean {
  const data = metadata as any;
  const planProposals = Array.isArray(data?.planProposals) ? data.planProposals : [];
  const activityLogProposals = Array.isArray(data?.activityLogProposals)
    ? data.activityLogProposals
    : [];
  const activityEditProposals = Array.isArray(data?.activityEditProposals)
    ? data.activityEditProposals
    : [];
  const planCreationProposals = Array.isArray(data?.planCreationProposals)
    ? data.planCreationProposals
    : [];

  return (
    [
      ...planProposals,
      ...activityLogProposals,
      ...activityEditProposals,
      ...planCreationProposals,
    ].some((proposal) => !proposal.status) ||
    (data?.metricReplacement && !data.metricReplacement.status)
  );
}

// Conclude autonomous COACH notifications tied to `messageId` once the message has
// no pending actions left. Called both from proposal accept/reject (work done) and
// from mark-read (informational notices like a plan-archived notice clear on read).
export async function concludeResolvedAutonomousCoachNotifications(
  userId: string,
  chatId: string,
  messageId: string,
): Promise<void> {
  const notifications = await prisma.notification.findMany({
    where: {
      userId,
      type: "COACH",
      promptTag: AUTONOMOUS_COACH_PROMPT_TAG,
      relatedId: chatId,
      status: { not: "CONCLUDED" },
    },
  });

  const matchingNotifications = notifications.filter((notification) => {
    const relatedData = notification.relatedData as any;
    return (
      Array.isArray(relatedData?.messageIds) &&
      relatedData.messageIds.includes(messageId)
    );
  });

  for (const notification of matchingNotifications) {
    const relatedData = notification.relatedData as any;
    const messageIds = relatedData.messageIds.filter(
      (id: unknown) => typeof id === "string",
    );
    const messages = await prisma.message.findMany({
      where: { id: { in: messageIds } },
      select: { metadata: true },
    });
    const hasPendingActions = messages.some((message) =>
      hasPendingCoachActions(message.metadata),
    );

    if (!hasPendingActions) {
      await prisma.notification.update({
        where: { id: notification.id },
        data: { status: "CONCLUDED", concludedAt: new Date() },
      });
      logger.info(
        `Concluded autonomous coach notification ${notification.id} after pending actions were resolved`,
      );
    }
  }
}

// Direct dismissal of informational "plan archived" notices (the "Got it" button),
// matched by the attention item dedupeKey or by overlapping plan ids.
export async function dismissArchivedCoachNotifications(
  userId: string,
  params: { dedupeKey?: string; planIds?: string[] },
): Promise<number> {
  const notifications = await prisma.notification.findMany({
    where: {
      userId,
      type: "COACH",
      promptTag: AUTONOMOUS_COACH_PROMPT_TAG,
      status: { not: "CONCLUDED" },
      relatedData: {
        path: ["interventionType"],
        equals: "PLAN_ATTENTION_ARCHIVED",
      },
    },
  });

  const targetPlanIds = params.planIds ?? [];
  const matching = notifications.filter((notification) => {
    const relatedData = notification.relatedData as any;
    const items: any[] = Array.isArray(relatedData?.coachAttentionItems)
      ? relatedData.coachAttentionItems
      : [];

    if (params.dedupeKey && items.some((item) => item?.dedupeKey === params.dedupeKey)) {
      return true;
    }
    if (targetPlanIds.length > 0) {
      const notificationPlanIds: string[] = Array.isArray(relatedData?.planIds)
        ? relatedData.planIds
        : items.flatMap((item) => item?.planIds ?? []);
      if (notificationPlanIds.some((planId) => targetPlanIds.includes(planId))) {
        return true;
      }
    }
    return false;
  });

  if (matching.length === 0) return 0;

  await prisma.notification.updateMany({
    where: { id: { in: matching.map((notification) => notification.id) } },
    data: { status: "CONCLUDED", concludedAt: new Date() },
  });
  return matching.length;
}
