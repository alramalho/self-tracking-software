import { CoachConcern, CoachConcernStatus, Prisma } from "@tsw/prisma";
import { prisma } from "../../../utils/prisma";
import {
  concernDedupeKey,
  CONCERN_RESOLVED_REASON,
  type ConcernObservation,
  type ConcernResolvedReason,
} from "./types";

// Concerns that are still "live" and the coach may still act on.
const ACTIVE_STATUSES: CoachConcernStatus[] = ["OPEN", "RAISED", "ESCALATED", "SNOOZED"];

interface MarkRaisedOptions {
  status?: CoachConcernStatus; // RAISED (default) or ESCALATED, decided by the reconciler
  messageId?: string | null;
  notificationId?: string | null;
  nextEligibleAt?: Date | null; // cooldown before this concern can be raised again
}

// Durable ledger of coach concerns. Every method takes an explicit `now` so the
// same code drives both the live cron and the historical backtest harness.
class CoachConcernService {
  // Detection-tick upsert. Creates an OPEN concern, refreshes an existing live one,
  // or reopens one that was previously resolved/archived (a recurrence).
  async observe(observation: ConcernObservation, now: Date): Promise<CoachConcern> {
    const dedupeKey = concernDedupeKey(observation.kind, observation.planId);
    const data = (observation.data ?? undefined) as Prisma.InputJsonValue | undefined;

    const existing = await prisma.coachConcern.findUnique({
      where: { userId_dedupeKey: { userId: observation.userId, dedupeKey } },
    });

    if (!existing) {
      return prisma.coachConcern.create({
        data: {
          userId: observation.userId,
          planId: observation.planId ?? null,
          kind: observation.kind,
          dedupeKey,
          severity: observation.severity ?? 0,
          ...(data !== undefined ? { data } : {}),
          status: "OPEN",
          firstDetectedAt: now,
          lastDetectedAt: now,
        },
      });
    }

    const reopening = existing.status === "RESOLVED" || existing.status === "ARCHIVED";
    return prisma.coachConcern.update({
      where: { id: existing.id },
      data: {
        lastDetectedAt: now,
        severity: observation.severity ?? existing.severity,
        ...(data !== undefined ? { data } : {}),
        ...(reopening
          ? {
              status: "OPEN",
              raisedCount: 0,
              nextEligibleAt: null,
              snoozedUntil: null,
              resolvedAt: null,
              resolvedReason: null,
            }
          : {}),
      },
    });
  }

  async resolve(id: string, reason: ConcernResolvedReason, now: Date): Promise<void> {
    await prisma.coachConcern.update({
      where: { id },
      data: { status: "RESOLVED", resolvedAt: now, resolvedReason: reason },
    });
  }

  // Resolve every live concern the detectors did NOT report this tick (no longer true).
  async resolveMissing(
    userId: string,
    observedDedupeKeys: Set<string>,
    now: Date
  ): Promise<number> {
    const active = await prisma.coachConcern.findMany({
      where: { userId, status: { in: ACTIVE_STATUSES } },
      select: { id: true, dedupeKey: true },
    });
    const staleIds = active
      .filter((concern) => !observedDedupeKeys.has(concern.dedupeKey))
      .map((concern) => concern.id);

    if (staleIds.length === 0) return 0;

    await prisma.coachConcern.updateMany({
      where: { id: { in: staleIds } },
      data: {
        status: "RESOLVED",
        resolvedAt: now,
        resolvedReason: CONCERN_RESOLVED_REASON.STALE,
      },
    });
    return staleIds.length;
  }

  // Concerns the reconciler may raise right now: live, off cooldown, not snoozed.
  // Ordered so the most severe (and oldest as tiebreak) come first.
  async getDue(userId: string, now: Date): Promise<CoachConcern[]> {
    return prisma.coachConcern.findMany({
      where: {
        userId,
        status: { in: ACTIVE_STATUSES },
        AND: [
          { OR: [{ nextEligibleAt: null }, { nextEligibleAt: { lte: now } }] },
          { OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: now } }] },
        ],
      },
      orderBy: [{ severity: "desc" }, { firstDetectedAt: "asc" }],
    });
  }

  async getActive(userId: string): Promise<CoachConcern[]> {
    return prisma.coachConcern.findMany({
      where: { userId, status: { in: ACTIVE_STATUSES } },
      orderBy: [{ severity: "desc" }, { firstDetectedAt: "asc" }],
    });
  }

  // Called by the reconciler after a message addressing the concern is sent.
  async markRaised(id: string, options: MarkRaisedOptions, now: Date): Promise<void> {
    await prisma.coachConcern.update({
      where: { id },
      data: {
        status: options.status ?? "RAISED",
        raisedCount: { increment: 1 },
        lastRaisedAt: now,
        nextEligibleAt: options.nextEligibleAt ?? null,
        ...(options.messageId !== undefined ? { lastMessageId: options.messageId } : {}),
        ...(options.notificationId !== undefined
          ? { lastNotificationId: options.notificationId }
          : {}),
      },
    });
  }

  async snooze(id: string, until: Date): Promise<void> {
    await prisma.coachConcern.update({
      where: { id },
      data: { status: "SNOOZED", snoozedUntil: until },
    });
  }
}

export const coachConcernService = new CoachConcernService();
