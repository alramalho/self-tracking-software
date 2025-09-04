import { logger } from "@/utils/logger";
import { Connection, Prisma, User } from "@tsw/prisma";
import { UserSearchResult } from "../types/user";
import { prisma } from "../utils/prisma";
import { usersPineconeService } from "./pineconeService";

type UserWithPlans = Prisma.UserGetPayload<{
  include: { plans: true };
}>;

export class UserService {
  async getAllUsers(): Promise<User[]> {
    return prisma.user.findMany({
      where: {
        deletedAt: null,
        OR: [
          { email: { not: { startsWith: "alexandre.ramalho.1998+" } } },
          { email: { not: { startsWith: "lia.borges+" } } },
        ],
      },
    });
  }

  async getAllPaidUsers(): Promise<UserWithPlans[]> {
    return prisma.user.findMany({
      where: {
        deletedAt: null,
        planType: "PLUS",
      },
      include: {
        plans: true,
      },
    });
  }

  async getUserById(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  async getUserByUsername(username: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { username: username.toLowerCase() },
    });
  }

  async getUserByClerkId(clerkId: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { clerkId },
    });
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  async updateUser(id: string, data: Partial<User>): Promise<User> {
    return prisma.user.update({
      where: { id },
      data,
    });
  }

  async searchUsers(
    currentUserId: string,
    searchTerm: string,
    limit: number = 3
  ): Promise<UserSearchResult[]> {
    const users = await prisma.user.findMany({
      where: {
        id: {
          not: currentUserId,
        },
        deletedAt: null,
        OR: [
          { email: { not: { startsWith: "alexandre.ramalho.1998+" } } },
          { email: { not: { startsWith: "lia.borges+" } } },
        ],
        username: {
          contains: searchTerm.toLowerCase(),
          mode: "insensitive",
        },
      },
      select: {
        id: true,
        username: true,
        name: true,
        picture: true,
      },
      take: limit,
    });

    return users.map((user) => ({
      userId: user.id,
      username: user.username!,
      name: user.name,
      picture: user.picture,
    }));
  }

  async getUserConnections(userId: string): Promise<User[]> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
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

    if (!user) return [];

    return [
      ...user.connectionsFrom.map((conn) => conn.to),
      ...user.connectionsTo.map((conn) => conn.from),
    ];
  }

  async getConnectionCount(userId: string): Promise<number> {
    const connectionsFrom = await prisma.connection.count({
      where: {
        fromId: userId,
        status: "ACCEPTED",
      },
    });

    const connectionsTo = await prisma.connection.count({
      where: {
        toId: userId,
        status: "ACCEPTED",
      },
    });

    return connectionsFrom + connectionsTo;
  }

  async sendConnectionRequest(
    fromId: string,
    toId: string,
    message?: string
  ): Promise<Connection> {
    // Check if connection already exists
    const existingConnection = await prisma.connection.findUnique({
      where: {
        fromId_toId: {
          fromId,
          toId,
        },
      },
    });

    if (existingConnection) {
      return existingConnection;
    }

    return prisma.connection.create({
      data: {
        fromId,
        toId,
        message,
        status: "PENDING",
      },
    });
  }

  async acceptConnectionRequest(
    connectionId: string
  ): Promise<{ from: User; to: User }> {
    const connection = await prisma.connection.update({
      where: { id: connectionId },
      data: { status: "ACCEPTED" },
      include: {
        from: true,
        to: true,
      },
    });

    return {
      from: connection.from,
      to: connection.to,
    };
  }

  async rejectConnectionRequest(connectionId: string): Promise<User> {
    const connection = await prisma.connection.update({
      where: { id: connectionId },
      data: { status: "REJECTED" },
      include: {
        from: true,
      },
    });

    return connection.from;
  }

  async getPendingSentConnectionRequests(
    userId: string
  ): Promise<Connection[]> {
    return prisma.connection.findMany({
      where: {
        fromId: userId,
        status: "PENDING",
      },
      include: {
        to: true,
      },
    });
  }

  async getPendingReceivedConnectionRequests(
    userId: string
  ): Promise<Connection[]> {
    return prisma.connection.findMany({
      where: {
        toId: userId,
        status: "PENDING",
      },
      include: {
        from: true,
      },
    });
  }

  // async loadSingleUserData(
  //   userId: string,
  //   currentUserId: string
  // ): Promise<any> {
  //   const [user, activities, activityEntries, plans] =
  //     await Promise.all([
  //       prisma.user.findUnique({
  //         where: { id: userId },
  //         include: {
  //           connectionsFrom: {
  //             where: { status: "PENDING" },
  //             include: { to: true },
  //           },
  //           connectionsTo: {
  //             where: { status: "PENDING" },
  //             include: { from: true },
  //           },
  //         },
  //       }),
  //       prisma.activity.findMany({
  //         where: { userId, deletedAt: null },
  //       }),
  //       prisma.activityEntry.findMany({
  //         where: { userId, deletedAt: null },
  //       }),
  //       prisma.plan.findMany({
  //         where: { userId, deletedAt: null },
  //         include: {
  //           activities: true,
  //           sessions: true,
  //         },
  //       }),
  //     ]);

  //   // Plan groups will need to be fetched based on plan IDs
  //   const planGroups: PlanGroup[] = [];

  //   if (!user) {
  //     throw new Error("User not found");
  //   }

  //   // Generate bio based on plans and activities
  //   const generatedBio = this.generateUserBio(plans, activities);

  //   const result: any = {
  //     user: {
  //       ...user,
  //       generated_bio: generatedBio,
  //     },
  //     activities,
  //     activity_entries: activityEntries,
  //     plans: plans,
  //     plan_groups: planGroups,
  //   };

  //   if (currentUserId === userId) {
  //     result.sent_friend_requests = sentFriendRequests;
  //     result.received_friend_requests = receivedFriendRequests;
  //   }

  //   return result;
  // }

  // private generateUserBio(plans: any[], activities: Activity[]): string {
  //   const bioParts: string[] = [];

  //   // Add plans info to bio
  //   if (plans.length > 0) {
  //     const planGoals = plans
  //       .slice(0, 3)
  //       .map((plan) => `${plan.emoji || "📋"} ${plan.goal}`);

  //     if (plans.length > 3) {
  //       bioParts.push(
  //         `Working on ${plans.length} plans including ${planGoals.slice(0, -1).join(", ")} and ${planGoals[planGoals.length - 1]}`
  //       );
  //     } else if (plans.length > 1) {
  //       bioParts.push(
  //         `Working on ${planGoals.slice(0, -1).join(", ")} and ${planGoals[planGoals.length - 1]}`
  //       );
  //     } else {
  //       bioParts.push(`Working on ${planGoals[0]}`);
  //     }
  //   }

  //   // Add activities info to bio
  //   if (activities.length > 0) {
  //     const activitySummary = activities
  //       .slice(0, 3)
  //       .map((activity) => activity.emoji)
  //       .join(" ");

  //     bioParts.push(`Tracking ${activitySummary}`);
  //   }

  //   return bioParts.length > 0
  //     ? bioParts.join(" | ")
  //     : "Just joined tracking.so!";
  // }

  async getTimelineData(userId: string): Promise<any> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
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

    if (!user) {
      return {
        recommended_activity_entries: [],
        recommended_activities: [],
        recommended_users: [],
      };
    }

    const connectedUsers = [
      ...user.connectionsFrom.map((conn) => conn.to),
      ...user.connectionsTo.map((conn) => conn.from),
    ];

    if (connectedUsers.length === 0) {
      return {
        recommended_activity_entries: [],
        recommended_activities: [],
        recommended_users: [],
      };
    }

    const userIds = [userId, ...connectedUsers.map((f) => f.id)];

    const activityEntries = await prisma.activityEntry.findMany({
      where: {
        userId: { in: userIds },
        deletedAt: null,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50, // MAX_TIMELINE_ENTRIES equivalent
      include: {
        activity: true,
        user: true,
      },
    });

    const activityIds = [
      ...new Set(activityEntries.map((entry) => entry.activityId)),
    ];
    const activities = await prisma.activity.findMany({
      where: {
        id: { in: activityIds },
      },
    });

    return {
      recommended_activity_entries: activityEntries,
      recommended_activities: activities,
      recommended_users: [user, ...connectedUsers],
    };
  }

  async handleReferral(
    referrerUsername: string,
    newUserId: string
  ): Promise<void> {
    const referrer = await this.getUserByUsername(referrerUsername);
    if (!referrer) {
      throw new Error("Referrer not found");
    }

    // Update referrer's referredUsers relationship
    await prisma.user.update({
      where: { id: referrer.id },
      data: {
        referredUsers: {
          connect: { id: newUserId },
        },
      },
    });
  }

  async updateUserEmbedding(user: User): Promise<void> {
    try {
      if (user.profile) {
        await usersPineconeService.upsertRecord(user.profile, user.id, {
          user_id: user.id,
        });
        logger.info(`Updated user embedding for plan ${user.id}`);
      }
    } catch (error) {
      logger.error(
        `Failed to update user embedding for plan ${user.id}:`,
        error
      );
      // Don't throw the error to avoid breaking user operations
    }
  }
}

export const userService = new UserService();
