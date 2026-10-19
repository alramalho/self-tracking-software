import type { FollowThroughState } from "@tsw/prisma/follow-through";
import { prisma } from "../../../utils/prisma";
import type { OpenAgenda } from "./types";

const OPEN_FOR_MS = 7 * 86400000;

export const heldProposalRef = (requestId: string, index: number) => `${requestId}#${index}`;

/** The most recent opener's agenda, while it is still fresh enough to talk about. */
export async function readOpenAgenda(userId: string, now = new Date()): Promise<OpenAgenda | null> {
  const saved = await prisma.coachingState.findUnique({ where: { userId } });
  const state = saved?.data as unknown as FollowThroughState | undefined;
  const request = (state?.monitoring?.requests ?? [])
    .filter((r) => r.agenda && now.getTime() - Date.parse(r.createdAt) < OPEN_FOR_MS)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
  if (!request?.agenda) return null;

  const [opener, laterCoachMessages] = await Promise.all([
    request.messageId
      ? prisma.message.findFirst({
          where: { id: request.messageId, chat: { userId } },
          select: { content: true },
        })
      : null,
    prisma.message.findMany({
      where: {
        chat: { userId, type: "COACH" },
        role: "COACH",
        createdAt: { gt: new Date(request.createdAt) },
      },
      select: { metadata: true },
    }),
  ]);
  const sharedRefs = new Set(
    laterCoachMessages.flatMap((m) => {
      const proposals = (m.metadata as { planProposals?: { heldFrom?: string }[] } | null)?.planProposals ?? [];
      return proposals.flatMap((p) => (p.heldFrom ? [p.heldFrom] : []));
    }),
  );

  return {
    requestId: request.id,
    createdAt: request.createdAt,
    opener: opener?.content ?? null,
    briefing: request.agenda.briefing,
    proposals: request.agenda.proposals.map((proposal, index) => {
      const ref = heldProposalRef(request.id, index);
      return { ref, proposal, shared: sharedRefs.has(ref) };
    }),
  };
}
