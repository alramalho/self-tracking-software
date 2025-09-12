"use server";

import { validateUser } from "@/lib/server-utils";
import { prisma } from "@tsw/prisma";

export async function getActivities() {
  const user = await validateUser();
  const activities = await prisma.activity.findMany({
    where: { userId: user.id, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
  return activities;
}
export async function getActivitiyEntries() {
  const user = await validateUser();
  const activityEntries = await prisma.activityEntry.findMany({
    where: { userId: user.id, deletedAt: null },
    include: {
      comments: {
        where: { deletedAt: null },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              picture: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      reactions: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              picture: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return activityEntries;
}
