import { logger } from "../../utils/logger";
import { prisma } from "../../utils/prisma";
import { notificationService } from "../notificationService";
import { canRecipientAccessPhotoNotification } from "./visibility";

const MAX_ATTEMPTS = 3;
const CLAIM_LEASE_MS = 5 * 60 * 1000;
const RETRY_DELAY_MS = [0, 2 * 60 * 1000, 4 * 60 * 1000];
const PHOTO_KEY_PREFIX = "ACTIVITY_PHOTO:";

export async function processPhotoNotification(
  notificationId: string,
  now = new Date(),
): Promise<boolean> {
  const claim = await prisma.notification.updateMany({
    where: {
      id: notificationId,
      dedupeKey: { startsWith: PHOTO_KEY_PREFIX },
      status: "PENDING",
      deliveryAttempts: { lt: MAX_ATTEMPTS },
      AND: [
        {
          OR: [
            { deliveryClaimedAt: null },
            {
              deliveryClaimedAt: {
                lte: new Date(now.getTime() - CLAIM_LEASE_MS),
              },
            },
          ],
        },
        {
          OR: [
            { nextDeliveryAttemptAt: null },
            { nextDeliveryAttemptAt: { lte: now } },
          ],
        },
      ],
    },
    data: {
      deliveryClaimedAt: now,
      deliveryAttempts: { increment: 1 },
    },
  });
  if (claim.count === 0) return false;

  const notification = await prisma.notification.findUniqueOrThrow({
    where: { id: notificationId },
    include: { user: true },
  });
  if (
    notification.user.deletedAt ||
    !(await canRecipientAccessPhotoNotification(
      notification.userId,
      notification.relatedId,
      now,
    ))
  ) {
    await prisma.notification.deleteMany({
      where: { id: notification.id, status: "PENDING" },
    });
    return false;
  }
  const user = notification.user;
  const pushEnabled =
    (user.isIosNotificationsEnabled && !!user.iosDeviceToken) ||
    (user.isPwaNotificationsEnabled && !!user.pwaSubscriptionEndpoint);

  try {
    const result = pushEnabled
      ? await notificationService.sendPushNotification(
          user.id,
          notification.title || `hey ${user.name || user.username} 👋`,
          notification.message.toLowerCase(),
        )
      : null;
    await prisma.notification.update({
      where: { id: notification.id },
      data: {
        status: "PROCESSED",
        processedAt: new Date(),
        sentAt: result && result.platform !== "none" ? new Date() : null,
        deliveryClaimedAt: null,
        nextDeliveryAttemptAt: null,
      },
    });
    return true;
  } catch (error) {
    const exhausted = notification.deliveryAttempts >= MAX_ATTEMPTS;
    await prisma.notification.update({
      where: { id: notification.id },
      data: {
        status: exhausted ? "PROCESSED" : "PENDING",
        processedAt: exhausted ? new Date() : null,
        deliveryClaimedAt: null,
        nextDeliveryAttemptAt: exhausted
          ? null
          : new Date(
              now.getTime() + RETRY_DELAY_MS[notification.deliveryAttempts],
            ),
      },
    });
    logger.error(
      `Photo notification ${notification.id} push attempt ${notification.deliveryAttempts} failed:`,
      error,
    );
    return false;
  }
}

export async function retryPendingPhotoNotifications(
  now = new Date(),
): Promise<void> {
  const expiredClaim = new Date(now.getTime() - CLAIM_LEASE_MS);
  // A process can die during its final claim. Keep the inbox record, and stop
  // retrying once the lease expires rather than leave it stuck in PENDING.
  await prisma.notification.updateMany({
    where: {
      dedupeKey: { startsWith: PHOTO_KEY_PREFIX },
      status: "PENDING",
      deliveryAttempts: { gte: MAX_ATTEMPTS },
      deliveryClaimedAt: { lte: expiredClaim },
    },
    data: { status: "PROCESSED", processedAt: now, deliveryClaimedAt: null },
  });
  const pending = await prisma.notification.findMany({
    where: {
      dedupeKey: { startsWith: PHOTO_KEY_PREFIX },
      status: "PENDING",
      deliveryAttempts: { lt: MAX_ATTEMPTS },
      AND: [
        {
          OR: [
            { deliveryClaimedAt: null },
            { deliveryClaimedAt: { lte: expiredClaim } },
          ],
        },
        {
          OR: [
            { nextDeliveryAttemptAt: null },
            { nextDeliveryAttemptAt: { lte: now } },
          ],
        },
      ],
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  const outcomes = await Promise.allSettled(
    pending.map((item) => processPhotoNotification(item.id, now)),
  );
  outcomes.forEach((outcome, index) => {
    if (outcome.status === "rejected") {
      logger.error(
        `Could not retry photo notification ${pending[index].id}:`,
        outcome.reason,
      );
    }
  });
}
