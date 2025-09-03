"use server";

import { validateUser } from "@/lib/server-utils";
import { prisma } from "@tsw/prisma";

export async function getNotifications() {
  const user = await validateUser();
  const notifications = await prisma.notification.findMany({
    where: {
      userId: user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
  return notifications;
}
