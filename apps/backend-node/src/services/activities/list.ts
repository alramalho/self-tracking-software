import { prisma } from "@/utils/prisma";

export async function listActivitiesByUsage(userId: string) {
  const activities = await prisma.activity.findMany({
    where: { userId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          entries: { where: { userId, deletedAt: null } },
        },
      },
    },
  });

  // Match the phone's activity picker: log count, then existing newest-first order.
  // Return only activity fields so existing Watch clients need no model changes.
  return activities
    .sort((left, right) => right._count.entries - left._count.entries)
    .map(({ _count, ...activity }) => activity);
}
