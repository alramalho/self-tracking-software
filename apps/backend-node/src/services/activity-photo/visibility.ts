import { getActivityEntryImageUrls } from "../../utils/activityEntryImages";
import { prisma } from "../../utils/prisma";

export async function isPhotoActivityVisibleToConnections(
  ownerId: string,
  activityId: string,
  now: Date,
): Promise<boolean> {
  const plans = await prisma.plan.findMany({
    where: {
      userId: ownerId,
      deletedAt: null,
      OR: [{ finishingDate: { gt: now } }, { finishingDate: null }],
      activities: { some: { id: activityId } },
    },
    select: { visibility: true },
  });
  return (
    plans.length === 0 || plans.some((plan) => plan.visibility === "PUBLIC")
  );
}

export async function canRecipientAccessPhotoNotification(
  recipientId: string,
  entryId: string | null,
  now: Date,
): Promise<boolean> {
  if (!entryId) return false;
  const entry = await prisma.activityEntry.findFirst({
    where: {
      id: entryId,
      deletedAt: null,
      activityId: { not: null },
      activity: { deletedAt: null },
    },
    select: {
      userId: true,
      activityId: true,
      imageUrl: true,
      imageUrls: true,
    },
  });
  if (!entry?.activityId || getActivityEntryImageUrls(entry).length === 0) {
    return false;
  }
  const [owner, connection, visible] = await Promise.all([
    prisma.user.findUnique({
      where: { id: entry.userId },
      select: { deletedAt: true },
    }),
    prisma.connection.findFirst({
      where: {
        status: "ACCEPTED",
        OR: [
          { fromId: entry.userId, toId: recipientId },
          { fromId: recipientId, toId: entry.userId },
        ],
      },
      select: { id: true },
    }),
    isPhotoActivityVisibleToConnections(entry.userId, entry.activityId, now),
  ]);
  return !!owner && !owner.deletedAt && !!connection && visible;
}
