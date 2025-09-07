"use server";

import prisma from "@/lib/prisma";
import { validateUser } from "@/lib/server-utils";
import { Prisma } from "@tsw/prisma";

export type HydratedCurrentUser = Awaited<
  ReturnType<typeof getCurrentUserBasicData>
>;
export type HydratedUser = Awaited<
  ReturnType<typeof getUserFullDataByUserNameOrId>
>;

export async function getCurrentUserBasicData() {
  const user = await validateUser();

  const userData = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      connectionsFrom: {
        where: { status: "ACCEPTED" },
        include: {
          to: {
            select: { id: true, username: true, name: true, picture: true },
          },
        },
      },
      connectionsTo: {
        where: { status: "ACCEPTED" },
        include: {
          from: {
            select: { id: true, username: true, name: true, picture: true },
          },
        },
      },
    },
  });

  if (!userData) {
    throw new Error("User not found");
  }

  // Combine friends from both directions
  const friends = [
    ...(userData.connectionsFrom?.map((conn) => conn.to) || []),
    ...(userData.connectionsTo?.map((conn) => conn.from) || []),
  ];

  return {
    ...userData,
    friends,
  };
}

export async function getUserFullDataByUserNameOrId(
  data: Array<{
    username?: string;
    id?: string;
  }>
) {
  if (!data.length) {
    throw new Error("At least one username or id is required");
  }

  const where = data.map((item) => {
    if (item.id) {
      return { id: item.id };
    } else if (item.username) {
      return { username: item.username };
    }
    throw new Error("Username or id is required for each item");
  });

  const usersData = await prisma.user.findMany({
    where: {
      OR: where,
    },
    include: {
      plans: {
        where: {
          deletedAt: null,
          OR: [{ finishingDate: { gt: new Date() } }, { finishingDate: null }],
        },
        include: {
          activities: true,
        },
      },
      activities: {
        where: {
          deletedAt: null,
        },
      },
      activityEntries: {
        where: {
          deletedAt: null,
        },
      },
      connectionsFrom: {
        where: { status: "ACCEPTED" },
        include: {
          to: {
            select: { id: true, username: true, name: true, picture: true },
          },
        },
      },
      connectionsTo: {
        where: { status: "ACCEPTED" },
        include: {
          from: {
            select: { id: true, username: true, name: true, picture: true },
          },
        },
      },
    },
  });

  if (!usersData.length) {
    throw new Error("No users found");
  }

  return usersData.map((userData) => {
    // Combine friends from both directions for each user
    const friends = [
      ...(userData.connectionsFrom?.map((conn) => conn.to) || []),
      ...(userData.connectionsTo?.map((conn) => conn.from) || []),
    ];

    return {
      ...userData,
      friends,
    };
  });
}

export async function updateUser(data: Prisma.UserUpdateInput) {
  const user = await validateUser();

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data,
  });
  return updatedUser;
}

export type UserBasicData = Awaited<ReturnType<typeof getCurrentUserBasicData>>;
export type PublicUserData = Awaited<
  ReturnType<typeof getUserFullDataByUserNameOrId>
>;
