import { logger } from "../utils/logger";
import { prisma } from "../utils/prisma";

export const CANCELLED_PLAN_CREATION_STATUS = "cancelled";

export async function cancelPendingPlanCreationProposals(
  chatId: string,
  exceptMessageIds: string[] = []
): Promise<number> {
  const messages = await prisma.message.findMany({
    where: {
      chatId,
      role: "COACH",
      ...(exceptMessageIds.length > 0
        ? { id: { notIn: exceptMessageIds } }
        : {}),
    },
    select: {
      id: true,
      metadata: true,
    },
  });

  let cancelledCount = 0;
  const cancelledAt = new Date().toISOString();

  for (const message of messages) {
    const metadata = message.metadata as any;
    const proposals = metadata?.planCreationProposals;
    if (!Array.isArray(proposals)) continue;

    let changed = false;
    const nextProposals = proposals.map((proposal: any) => {
      if (proposal?.status) return proposal;

      changed = true;
      cancelledCount += 1;
      return {
        ...proposal,
        status: CANCELLED_PLAN_CREATION_STATUS,
        cancelledAt,
      };
    });

    if (!changed) continue;

    await prisma.message.update({
      where: { id: message.id },
      data: {
        metadata: {
          ...metadata,
          planCreationProposals: nextProposals,
        },
      },
    });
  }

  if (cancelledCount > 0) {
    logger.info(
      `Cancelled ${cancelledCount} pending plan creation proposal(s) in chat ${chatId}`
    );
  }

  return cancelledCount;
}
