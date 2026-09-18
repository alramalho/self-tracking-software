import type { InterviewState } from "@tsw/prisma/follow-through";
import { prisma } from "../../../../utils/prisma";
import type { InterviewContext } from "./types";

export async function getInterviewContext(
  userId: string,
  _state: InterviewState,
): Promise<InterviewContext> {
  const activities = await prisma.activity.findMany({
    where: { userId, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    take: 20,
    select: {
      title: true,
      measure: true,
      _count: {
        select: {
          entries: { where: { userId, deletedAt: null } },
        },
      },
      entries: {
        where: { userId, deletedAt: null },
        orderBy: { datetime: "desc" },
        take: 1,
        select: { datetime: true },
      },
    },
  });

  return {
    existingActivities: activities.map((activity) => ({
      title: activity.title,
      measure: activity.measure,
      entryCount: activity._count.entries,
      lastLoggedAt: activity.entries[0]?.datetime.toISOString().slice(0, 10) ?? null,
    })),
  };
}
