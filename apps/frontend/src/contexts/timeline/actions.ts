"use server";

import { validateUser } from "@/lib/server-utils";
import { prisma } from "@tsw/prisma";

export type TimelineData = Awaited<ReturnType<typeof getTimelineData>>;

export async function getTimelineData() {
  const user = await validateUser();

  try {
    const updatedUser = await prisma.user.findUnique({
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

    if (!updatedUser) {
      return {
        recommendedActivityEntries: [],
        recommendedActivities: [],
        recommendedUsers: [],
      };
    }

    const connectedUsers = [
      ...updatedUser.connectionsFrom.map((conn) => conn.to),
      ...updatedUser.connectionsTo.map((conn) => conn.from),
    ];

    if (connectedUsers.length === 0) {
      return {
        recommendedActivityEntries: [],
        recommendedActivities: [],
        recommendedUsers: [],
      };
    }

    const userIds = [updatedUser.id, ...connectedUsers.map((f) => f.id)];

    const activityEntries = await prisma.activityEntry.findMany({
      where: {
        userId: { in: userIds },
        deletedAt: null,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
      include: {
        activity: true,
        comments: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
        },
        reactions: {
          include: {
            user: {
              select: { id: true, username: true, picture: true },
            },
          },
        },
      },
    });

    const activityIds = Array.from(
      new Set(activityEntries.map((entry) => entry.activityId))
    );
    const activities = await prisma.activity.findMany({
      where: {
        id: { in: activityIds },
      },
    });

    return {
      recommendedActivityEntries: activityEntries,
      recommendedActivities: activities,
      recommendedUsers: [updatedUser, ...connectedUsers],
    };
  } catch (error) {
    console.error("Error fetching timeline data:", error);
    throw error;
  }
}
