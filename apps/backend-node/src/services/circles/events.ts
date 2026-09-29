import type { CircleEventKind, Prisma } from "@tsw/prisma";
import { logger } from "../../utils/logger";
import { prisma } from "../../utils/prisma";

interface CircleEventRef {
  userId: string;
  circleId?: string | null;
  planId?: string | null;
}

// The join funnel (joined → proved, or skipped / nudged / expired) for coach nudges and analytics.
// Recording never blocks the action it describes.
export async function recordCircleEvent(
  kind: CircleEventKind,
  ref: CircleEventRef,
  tx: Prisma.TransactionClient = prisma,
): Promise<void> {
  try {
    await tx.circleEvent.create({
      data: { kind, userId: ref.userId, circleId: ref.circleId ?? null, planId: ref.planId ?? null },
    });
  } catch (error) {
    logger.warn("Could not record a circle event", { kind, ...ref, error });
  }
}
