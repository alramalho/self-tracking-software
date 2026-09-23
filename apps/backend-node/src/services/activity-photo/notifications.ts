import { getActivityEntryImageUrls } from "../../utils/activityEntryImages";
import { logger } from "../../utils/logger";
import { prisma } from "../../utils/prisma";
import { isActivityPhotoNotificationEligible } from "./eligibility";
import { processPhotoNotification } from "./delivery";
import { notificationService } from "../notificationService";
import type { ActivityPhotoNotificationRequest } from "./types";
import { isPhotoActivityVisibleToConnections } from "./visibility";

const isUniqueConflict = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === "P2002";

export async function notifyConnectionsAboutActivityPhotos({
  user,
  activity,
  entry,
  photoAddedAt,
  now = new Date(),
}: ActivityPhotoNotificationRequest): Promise<void> {
  if (
    activity.deletedAt ||
    entry.deletedAt ||
    !entry.activityId ||
    entry.activityId !== activity.id ||
    getActivityEntryImageUrls(entry).length === 0 ||
    !isActivityPhotoNotificationEligible({
      // Manual logs use datetime as the time the activity was done. A live
      // workout records its explicit finish in endedAt, which also determines
      // whether its activity day is today when it crosses midnight.
      completedAt: entry.endedAt ?? entry.datetime,
      timezone: entry.timezone || user.timezone,
      // Eligibility is fixed when the photo is saved. Access and visibility
      // still use delivery time, including after an outbox retry.
      now: photoAddedAt ?? now,
    })
  ) {
    return;
  }

  if (!(await isPhotoActivityVisibleToConnections(user.id, activity.id, now))) {
    return;
  }

  const userWithConnections = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      connectionsFrom: {
        where: { status: "ACCEPTED" },
        include: { to: true },
      },
      connectionsTo: {
        where: { status: "ACCEPTED" },
        include: { from: true },
      },
    },
  });
  if (!userWithConnections) return;

  const recipients = new Map(
    [
      ...userWithConnections.connectionsFrom.map((connection) => connection.to),
      ...userWithConnections.connectionsTo.map((connection) => connection.from),
    ]
      .filter((recipient) => !recipient.deletedAt && recipient.id !== user.id)
      .map((recipient) => [recipient.id, recipient]),
  );
  const photoCount = getActivityEntryImageUrls(entry).length;
  const message = `@${user.username || user.name || "A friend"} added ${photoCount === 1 ? "a photo" : "photos"} to ${activity.emoji} ${activity.title} 📸`;

  const results = await Promise.allSettled(
    [...recipients.values()].map(async (recipient) => {
      const dedupeKey = `ACTIVITY_PHOTO:${entry.id}:${recipient.id}`;
      let notification;
      try {
        notification = await notificationService.createNotification({
          userId: recipient.id,
          message,
          type: "INFO",
          relatedId: entry.id,
          dedupeKey,
          relatedData: {
            activityEntryId: entry.id,
            userPicture: user.picture,
            userName: user.name,
            userUsername: user.username,
            category: "ACTIVITY_PHOTO",
          },
        });
      } catch (error) {
        if (!isUniqueConflict(error)) throw error;
        notification = await prisma.notification.findUnique({
          where: { dedupeKey },
        });
        if (!notification) throw error;
      }
      if (notification?.status === "PENDING") {
        await processPhotoNotification(notification.id, now);
      }
    }),
  );
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      logger.error(
        `Could not notify connection ${[...recipients.keys()][index]} about photo on entry ${entry.id}:`,
        result.reason,
      );
    }
  });
  const failures = results.filter(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  if (failures.length > 0) {
    throw new AggregateError(
      failures.map((result) => result.reason),
      `Could not queue photo notifications for entry ${entry.id}`,
    );
  }
}
