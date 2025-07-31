import {
  User,
  Activity,
  ActivityEntry,
  Plan,
  PlanGroup,
  FriendRequest,
  MoodReport,
  Recommendation,
} from "@prisma/client";
import { prisma } from "../utils/prisma";
import { logger } from "../utils/logger";
import { UserSearchResult, LoadUsersDataResponse } from "../types/user";

export class UserService {
  async getAllUsers(): Promise<User[]> {
    return prisma.user.findMany({
      where: {
        deleted: false,
        NOT: {
          email: {
            startsWith: "alexandre.ramalho.1998+",
          },
        },
      },
    });
  }

  async getAllPaidUsers(): Promise<User[]> {
    return prisma.user.findMany({
      where: {
        deleted: false,
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
        deleted: false,
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

  async getUserFriends(userId: string): Promise<User[]> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        friends: true,
      },
    });

    return user?.friends || [];
  }

  async getFriendCount(userId: string): Promise<number> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        _count: {
          select: { friends: true },
        },
      },
    });

    return user?._count.friends || 0;
  }

  async sendFriendRequest(
    senderId: string,
    recipientId: string,
    message?: string
  ): Promise<FriendRequest> {
    // Check if request already exists
    const existingRequest = await prisma.friendRequest.findFirst({
      where: {
        senderId,
        recipientId,
        status: "PENDING",
      },
    });

    if (existingRequest) {
      return existingRequest;
    }

    return prisma.friendRequest.create({
      data: {
        senderId,
        recipientId,
        message,
        status: "PENDING",
      },
    });
  }

  async acceptFriendRequest(
    requestId: string
  ): Promise<{ sender: User; recipient: User }> {
    return prisma.$transaction(async (tx) => {
      // Update request status
      const friendRequest = await tx.friendRequest.update({
        where: { id: requestId },
        data: { status: "ACCEPTED" },
        include: {
          sender: true,
          recipient: true,
        },
      });

      // Add users as friends (many-to-many relationship)
      await tx.user.update({
        where: { id: friendRequest.senderId },
        data: {
          friends: {
            connect: { id: friendRequest.recipientId },
          },
        },
      });

      await tx.user.update({
        where: { id: friendRequest.recipientId },
        data: {
          friends: {
            connect: { id: friendRequest.senderId },
          },
        },
      });

      return {
        sender: friendRequest.sender,
        recipient: friendRequest.recipient,
      };
    });
  }

  async rejectFriendRequest(requestId: string): Promise<User> {
    const friendRequest = await prisma.friendRequest.update({
      where: { id: requestId },
      data: { status: "REJECTED" },
      include: {
        sender: true,
      },
    });

    return friendRequest.sender;
  }

  async getPendingSentFriendRequests(userId: string): Promise<FriendRequest[]> {
    return prisma.friendRequest.findMany({
      where: {
        senderId: userId,
        status: "PENDING",
      },
      include: {
        recipient: true,
      },
    });
  }

  async getPendingReceivedFriendRequests(
    userId: string
  ): Promise<FriendRequest[]> {
    return prisma.friendRequest.findMany({
      where: {
        recipientId: userId,
        status: "PENDING",
      },
      include: {
        sender: true,
      },
    });
  }

  async loadSingleUserData(
    userId: string,
    currentUserId: string
  ): Promise<any> {
    const [
      user,
      activities,
      activityEntries,
      moodReports,
      plans,
      sentFriendRequests,
      receivedFriendRequests,
    ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        include: {
          friends: true,
          friendRequestsSent: true,
          friendRequestsReceived: true,
        },
      }),
      prisma.activity.findMany({
        where: { userId, deletedAt: null },
      }),
      prisma.activityEntry.findMany({
        where: { userId, deletedAt: null },
      }),
      prisma.moodReport.findMany({
        where: { userId },
      }),
      prisma.plan.findMany({
        where: { userId, deletedAt: null },
        include: {
          activities: {
            include: {
              activity: true,
            },
          },
          sessions: true,
        },
      }),
      userId === currentUserId ? this.getPendingSentFriendRequests(userId) : [],
      userId === currentUserId
        ? this.getPendingReceivedFriendRequests(userId)
        : [],
    ]);

    // Plan groups will need to be fetched based on plan IDs
    const planGroups: PlanGroup[] = [];

    if (!user) {
      throw new Error("User not found");
    }

    // Generate bio based on plans and activities
    const generatedBio = this.generateUserBio(plans, activities);

    // Process plans to include activity details
    const plansWithActivities = plans.map((plan) => ({
      ...plan,
      activities: plan.activities.map((pa) => pa.activity),
    }));

    const result: any = {
      user: {
        ...user,
        generated_bio: generatedBio,
      },
      activities,
      activity_entries: activityEntries,
      mood_reports: moodReports,
      plans: plansWithActivities,
      plan_groups: planGroups,
    };

    if (currentUserId === userId) {
      result.sent_friend_requests = sentFriendRequests;
      result.received_friend_requests = receivedFriendRequests;
    }

    return result;
  }

  private generateUserBio(plans: any[], activities: Activity[]): string {
    const bioParts: string[] = [];

    // Add plans info to bio
    if (plans.length > 0) {
      const planGoals = plans
        .slice(0, 3)
        .map((plan) => `${plan.emoji || "📋"} ${plan.goal}`);

      if (plans.length > 3) {
        bioParts.push(
          `Working on ${plans.length} plans including ${planGoals.slice(0, -1).join(", ")} and ${planGoals[planGoals.length - 1]}`
        );
      } else if (plans.length > 1) {
        bioParts.push(
          `Working on ${planGoals.slice(0, -1).join(", ")} and ${planGoals[planGoals.length - 1]}`
        );
      } else {
        bioParts.push(`Working on ${planGoals[0]}`);
      }
    }

    // Add activities info to bio
    if (activities.length > 0) {
      const activitySummary = activities
        .slice(0, 3)
        .map((activity) => activity.emoji)
        .join(" ");

      bioParts.push(`Tracking ${activitySummary}`);
    }

    return bioParts.length > 0
      ? bioParts.join(" | ")
      : "Just joined tracking.so!";
  }

  async getTimelineData(userId: string): Promise<any> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        friends: true,
      },
    });

    if (!user || user.friends.length === 0) {
      return {
        recommended_activity_entries: [],
        recommended_activities: [],
        recommended_users: [],
      };
    }

    const userIds = [userId, ...user.friends.map((f) => f.id)];

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
      recommended_users: [user, ...user.friends],
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

  async getRecommendedUsers(userId: string): Promise<any> {
    // TODO: Implement recommendations logic
    // For now, return empty recommendations
    return {
      recommendations: [],
      users: [],
      plans: [],
    };
  }
}

export const userService = new UserService();
