import { logger } from "../../utils/logger";
import { prisma } from "../../utils/prisma";
import { notifyConnectionsAboutActivityPhotos } from "./notifications";

const CLAIM_LEASE_MS = 5 * 60 * 1000;
const RETRY_DELAY_MS = 2 * 60 * 1000;

export async function processPhotoNotificationOutbox(
  workId: string,
  now = new Date(),
): Promise<boolean> {
  const claimed = await prisma.activityPhotoNotificationOutbox.updateMany({
    where: {
      id: workId,
      processedAt: null,
      AND: [
        {
          OR: [
            { claimedAt: null },
            { claimedAt: { lte: new Date(now.getTime() - CLAIM_LEASE_MS) } },
          ],
        },
        {
          OR: [
            { nextAttemptAt: null },
            { nextAttemptAt: { lte: now } },
          ],
        },
      ],
    },
    data: { claimedAt: now, attempts: { increment: 1 } },
  });
  if (claimed.count === 0) return false;

  try {
    const work = await prisma.activityPhotoNotificationOutbox.findUnique({
      where: { id: workId },
      include: { entry: { include: { user: true, activity: true } } },
    });
    if (work?.entry.activity && !work.entry.user.deletedAt) {
      await notifyConnectionsAboutActivityPhotos({
        user: work.entry.user,
        activity: work.entry.activity,
        entry: work.entry,
        photoAddedAt: work.photoAddedAt,
        now,
      });
    }
    await prisma.activityPhotoNotificationOutbox.updateMany({
      where: { id: workId, claimedAt: now, processedAt: null },
      data: { processedAt: new Date(), claimedAt: null, nextAttemptAt: null },
    });
    return true;
  } catch (error) {
    await prisma.activityPhotoNotificationOutbox.updateMany({
      where: { id: workId, claimedAt: now, processedAt: null },
      data: {
        claimedAt: null,
        nextAttemptAt: new Date(now.getTime() + RETRY_DELAY_MS),
      },
    });
    logger.error(`Could not queue photo notification work ${workId}:`, error);
    return false;
  }
}

export async function retryPhotoNotificationOutbox(
  now = new Date(),
): Promise<void> {
  const pending = await prisma.activityPhotoNotificationOutbox.findMany({
    where: {
      processedAt: null,
      AND: [
        {
          OR: [
            { claimedAt: null },
            { claimedAt: { lte: new Date(now.getTime() - CLAIM_LEASE_MS) } },
          ],
        },
        {
          OR: [
            { nextAttemptAt: null },
            { nextAttemptAt: { lte: now } },
          ],
        },
      ],
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  const outcomes = await Promise.allSettled(
    pending.map((work) => processPhotoNotificationOutbox(work.id, now)),
  );
  outcomes.forEach((outcome, index) => {
    if (outcome.status === "rejected") {
      logger.error(
        `Could not retry photo notification work ${pending[index].id}:`,
        outcome.reason,
      );
    }
  });
}
