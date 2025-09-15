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
        plans: {
          where: {
            OR: [
              { finishingDate: { gt: new Date() } },
              { finishingDate: null },
            ],
          },
          include: {
            activities: { select: { id: true } },
          },
        },
        connectionsFrom: {
          include: {
            to: {
              select: {
                id: true,
                username: true,
                name: true,
                picture: true,
                planType: true,
                plans: {
                  where: {
                    OR: [
                      { finishingDate: { gt: new Date() } },
                      { finishingDate: null },
                    ],
                  },
                  include: {
                    activities: { select: { id: true } },
                  },
                }, // Add this
              },
            },
          },
        },
        connectionsTo: {
          include: {
            from: {
              select: {
                id: true,
                username: true,
                name: true,
                picture: true,
                planType: true,
                plans: {
                  where: {
                    OR: [
                      { finishingDate: { gt: new Date() } },
                      { finishingDate: null },
                    ],
                  },
                  include: {
                    activities: { select: { id: true } },
                  },
                }, // Add this
              },
            },
          },
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
      ...updatedUser.connectionsFrom
        .filter((conn) => conn.status === "ACCEPTED")
        .map((conn) => conn.to),
      ...updatedUser.connectionsTo
        .filter((conn) => conn.status === "ACCEPTED")
        .map((conn) => conn.from),
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
      orderBy: [
        {
          date: "desc",
        },
        {
          createdAt: "desc",
        },
      ],
      take: 50,
      include: {
        activity: true,
        comments: {
          where: { deletedAt: null },
          orderBy: { createdAt: "asc" },
          include: {
            user: {
              select: { id: true, username: true, picture: true },
            },
          },
        },
        reactions: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                picture: true,
                planType: true,
              },
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
