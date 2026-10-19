import { mergeConversion } from "@tsw/prisma/activity-duplicates";
import { prisma } from "../../utils/prisma";

export class ActivityMergeError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
  }
}

/**
 * Folds `removeId` into `keepId`: its logs, planned sessions and plans move over, then it is
 * removed. Nothing is deleted for good: the removed activity is soft-deleted and every log
 * keeps its date, photos, reactions and comments. When the two count in units that convert
 * exactly (hours and minutes), quantities are converted into the smaller unit first.
 */
export async function mergeActivities(userId: string, removeId: string, keepId: string) {
  if (removeId === keepId) throw new ActivityMergeError("Pick a different activity.", 400);

  return prisma.$transaction(async (tx) => {
    const [remove, keep] = await Promise.all(
      [removeId, keepId].map((id) =>
        tx.activity.findFirst({ where: { id, userId, deletedAt: null } }),
      ),
    );
    if (!remove || !keep) throw new ActivityMergeError("Activity not found", 404);
    const conversion = mergeConversion(keep, remove);
    if (conversion === undefined)
      throw new ActivityMergeError(
        `${remove.title} is counted in ${remove.measure} and ${keep.title} in ${keep.measure}, so their logs can't be added together.`,
        400,
      );

    if (conversion) {
      const activityId = conversion.activity.id;
      const quantity = { multiply: conversion.factor };
      await tx.activityEntry.updateMany({ where: { activityId }, data: { quantity } });
      await tx.planSession.updateMany({ where: { activityId }, data: { quantity } });
      if (activityId === keep.id)
        await tx.activity.update({
          where: { id: keep.id },
          data: { measure: conversion.to },
        });
    }

    const entries = await tx.activityEntry.updateMany({
      where: { activityId: remove.id },
      data: { activityId: keep.id },
    });
    await tx.planSession.updateMany({
      where: { activityId: remove.id },
      data: { activityId: keep.id },
    });

    const plans = await tx.plan.findMany({
      where: { userId, activities: { some: { id: remove.id } } },
      select: { id: true },
    });
    for (const plan of plans) {
      await tx.plan.update({
        where: { id: plan.id },
        data: {
          activities: { disconnect: { id: remove.id }, connect: { id: keep.id } },
        },
      });
    }
    // Progress counts the kept activity's new logs on the next fetch.
    await tx.plan.updateMany({
      where: { userId, activities: { some: { id: keep.id } } },
      data: { progressCalculatedAt: null },
    });

    await tx.activity.update({
      where: { id: remove.id },
      data: { deletedAt: new Date() },
    });

    const activity = await tx.activity.findUniqueOrThrow({ where: { id: keep.id } });
    return { activity, entriesMoved: entries.count, plansUpdated: plans.length };
  });
}
