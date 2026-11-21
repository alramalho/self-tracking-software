import { logger } from "../utils/logger";
import { prisma } from "../utils/prisma";

/**
 * The coach keeps one live suggestion per plan. When it suggests a new change to a plan, any older card for that
 * plan still waiting in the chat is marked "replaced"; when it decides the change is no longer needed, "withdrawn".
 * Either way the old card can no longer be accepted (the accept route refuses any proposal with a status).
 */
export async function settleOpenPlanChanges(
  chatId: string,
  settle: { replaced?: string[]; withdrawn?: string[] },
  exceptMessageIds: string[] = [],
): Promise<number> {
  const statusFor = new Map<string, "replaced" | "withdrawn">([
    ...(settle.withdrawn ?? []).map((id) => [id, "withdrawn"] as const),
    ...(settle.replaced ?? []).map((id) => [id, "replaced"] as const),
  ]);
  if (!statusFor.size) return 0;
  const messages = await prisma.message.findMany({
    where: { chatId, role: "COACH", ...(exceptMessageIds.length ? { id: { notIn: exceptMessageIds } } : {}) },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, metadata: true },
  });
  const settledAt = new Date().toISOString();
  let count = 0;
  for (const message of messages) {
    const metadata = message.metadata as any;
    const proposals = metadata?.planProposals;
    if (!Array.isArray(proposals)) continue;
    let changed = false;
    const next = proposals.map((proposal: any) => {
      const status = statusFor.get(proposal?.planId);
      if (!status || proposal?.status) return proposal;
      changed = true;
      count++;
      return { ...proposal, status, settledAt };
    });
    if (changed)
      await prisma.message.update({ where: { id: message.id }, data: { metadata: { ...metadata, planProposals: next } } });
  }
  if (count) logger.info(`Settled ${count} open plan change(s) in chat ${chatId}`);
  return count;
}
