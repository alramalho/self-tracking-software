import { createHash } from "node:crypto";
import { prisma } from "../../utils/prisma";
import { logger } from "../../utils/logger";
import { notificationService } from "../notificationService";
import { changeState, ownedPlans, recentEntries } from "./store";
import {
  materialize,
  outreach,
  reconcileEntries,
  hasRecentCoachClaim,
} from "./model";
import { canCoach } from "./service";
import type { ClaimedOutreach } from "./types";

/** Claims are durable before sending. Ambiguous network failures are not retried into duplicate pushes. */
export async function deliverFollowThrough() {
  const accounts = await prisma.coachingState.findMany({
    where: {
      user: { deletedAt: null },
      data: { path: ["enabled"], equals: true },
    },
    include: { user: true },
  });
  for (const account of accounts) {
    try {
      const messages = await changeState(account.userId, async (state, tx) => {
        const now = new Date(),
          plans = await ownedPlans(account.userId, tx);
        materialize(state, plans, now);
        const entries = await recentEntries(account.userId, tx);
        reconcileEntries(state, entries, now);
        const candidates = outreach(
          state,
          plans,
          now,
          canCoach(account.user),
          entries,
        );
        let hasRecentCheck = hasRecentCoachClaim(state, now);
        const pending: ClaimedOutreach[] = [];
        for (const candidate of candidates) {
          if (candidate.checkId && hasRecentCheck) continue;
          const notificationId = `ft-${createHash("sha256").update(`${account.userId}:${candidate.id}`).digest("hex").slice(0, 40)}`;
          if (
            await tx.notification.findUnique({ where: { id: notificationId } })
          )
            continue;
          const url = candidate.sessionId
            ? `/session/${encodeURIComponent(candidate.sessionId)}${candidate.checkId ? "?check=1" : ""}`
            : "/(tabs)/plans?view=week";
          await tx.notification.create({
            data: {
              id: notificationId,
              userId: account.userId,
              title: candidate.title,
              message: candidate.body,
              type: "INFO",
              status: "PROCESSED",
              processedAt: now,
              relatedId: candidate.sessionId ?? candidate.planId,
              relatedData: {
                url,
                followThrough: true,
                checkId: candidate.checkId,
              },
            },
          });
          pending.push({ ...candidate, notificationId, url });
          if (candidate.checkId) {
            hasRecentCheck = true;
            state.checks[candidate.checkId].claimedAt = now.toISOString();
          }
        }
        return pending;
      });
      for (const message of messages) {
        const sent = await notificationService.sendPushNotification(
          account.userId,
          message.title,
          message.body,
          message.url,
        );
        if (sent.platform === "none") continue;
        await prisma.notification.update({
          where: { id: message.notificationId },
          data: { sentAt: new Date() },
        });
        if (message.checkId)
          await changeState(account.userId, async (state) => {
            const check = state.checks[message.checkId!];
            if (check) check.sentAt = new Date().toISOString();
          });
      }
    } catch (error) {
      logger.error("Follow-through delivery failed", {
        userId: account.userId,
        error,
      });
    }
  }
}
