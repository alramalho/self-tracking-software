"use server";
import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { Prisma } from "@tsw/prisma";

export type HydratedCurrentUser = Awaited<
  ReturnType<typeof getCurrentUserData>
>;
export type HydratedUser = Awaited<ReturnType<typeof getUserData>>;
export type TimelineData = Awaited<ReturnType<typeof getTimelineData>>;

export async function validateUser() {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    throw new Error("User not authenticated");
  }
  const user = await prisma.user.findUnique({
    where: { clerkId },
  });
  const userId = user?.id;
  if (!userId) {
    throw new Error("User not authenticated");
  }
  return user;
}

export async function getUser() {
  return await validateUser();
}

export async function getCurrentUserData() {
  const user = await validateUser();

  try {
    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        activities: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
        },
        activityEntries: {
          where: { deletedAt: null },
          include: {
            reactions: {
              include: {
                user: {
                  select: { id: true, username: true, picture: true },
                },
              },
            },
            comments: {
              where: { deletedAt: null },
              orderBy: { createdAt: "desc" },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        plans: {
          where: { deletedAt: null },
          include: {
            sessions: true,
            activities: true,
            planGroup: {
              include: {
                members: true,
              },
            },
            milestones: true,
          },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        },
        planGroupMemberships: true,
        notifications: {
          orderBy: { createdAt: "desc" },
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

    const allConnections = [
      ...(userData?.connectionsFrom?.map((conn) => conn.to) || []),
      ...(userData?.connectionsTo?.map((conn) => conn.from) || []),
    ];

    if (!userData) {
      throw new Error("User not found");
    }

    return { ...userData, friends: allConnections };
  } catch (error) {
    console.error("Error fetching current user data:", error);
    throw error;
  }
}

export async function updatePlan(planId: string, data: Prisma.PlanUpdateInput) {
  const user = await validateUser();

  console.log(
    `Updating plan ${planId} for user ${user.id} with data ${JSON.stringify(
      data
    )}`
  );
  const plan = await prisma.plan.update({
    where: { userId: user.id, id: planId },
    data,
  });
  return plan;
}

export async function clearCoachSuggestedSessionsInPlan(planId: string) {
  const user = await validateUser();

  await prisma.planSession.deleteMany({
    where: {
      planId: planId,
      isCoachSuggested: true,
      plan: {
        userId: user.id,
      },
    },
  });
}

export async function upgradeCoachSuggestedSessionsToPlanSessions(
  planId: string
) {
  const user = await validateUser();

  // Delete all existing non-coach-suggested sessions for the plan
  await prisma.planSession.deleteMany({
    where: {
      planId: planId,
      isCoachSuggested: false,
      plan: {
        userId: user.id,
      },
    },
  });

  // Update all coach suggested sessions to turn off the isCoachSuggested flag
  await prisma.planSession.updateMany({
    where: {
      planId: planId,
      isCoachSuggested: true,
      plan: {
        userId: user.id,
      },
    },
    data: {
      isCoachSuggested: false,
    },
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

export async function getUserData(username: string) {
  await validateUser();

  try {
    const userData = await prisma.user.findUnique({
      where: { username },
      include: {
        activities: {
          where: {
            deletedAt: null,
            // OR: [{ privacySettings: "PUBLIC" }, { privacySettings: null }],
          },
          orderBy: { createdAt: "desc" },
        },
        activityEntries: {
          where: { deletedAt: null },
          include: {
            reactions: {
              include: {
                user: {
                  select: { id: true, username: true, picture: true },
                },
              },
            },
            comments: {
              where: { deletedAt: null },
              orderBy: { createdAt: "desc" },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        plans: {
          where: { deletedAt: null },
          include: {
            sessions: true,
            activities: true,
            planGroup: true,
          },
          orderBy: { createdAt: "desc" },
        },
        planGroupMemberships: true,
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

    const allConnections = [
      ...(userData?.connectionsFrom?.map((conn) => conn.to) || []),
      ...(userData?.connectionsTo?.map((conn) => conn.from) || []),
    ];

    // Filter activity entries based on privacy settings
    // const filteredActivityEntries = userData.activityEntries.filter(
    //   (ae) =>
    //     ae.activity.privacySettings === "PUBLIC" ||
    //     ae.activity.privacySettings === null
    // );

    return { ...userData, friends: allConnections };
  } catch (error) {
    console.error("Error fetching user data:", error);
    throw error;
  }
}

export async function getMetricsAndEntries() {
  const user = await validateUser();

  try {
    const [metrics, entries] = await Promise.all([
      prisma.metric.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
      }),
      prisma.metricEntry.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return {
      metrics,
      entries,
    };
  } catch (error) {
    console.error("Error fetching metrics data:", error);
    throw error;
  }
}

export async function getMessages() {
  const user = await validateUser();

  try {
    const messages = await prisma.message.findMany({
      where: {
        userId: user.id,
      },
      include: {
        emotions: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      messages,
    };
  } catch (error) {
    console.error("Error fetching messages:", error);
    throw error;
  }
}

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

export async function modifyManualMilestone(
  milestoneId: string,
  delta: number
) {
  const user = await validateUser();

  try {
    // Get the milestone to ensure it belongs to the user
    const milestone = await prisma.planMilestone.findFirst({
      where: {
        id: milestoneId,
        plan: {
          userId: user.id,
        },
      },
    });

    if (!milestone) {
      throw new Error("Milestone not found");
    }

    // Calculate new progress value
    const currentProgress = milestone.progress || 0;
    const newProgress = Math.min(Math.max(currentProgress + delta, 0), 100);

    // Update the milestone
    const updatedMilestone = await prisma.planMilestone.update({
      where: { id: milestoneId },
      data: { progress: newProgress },
    });

    return { success: true, milestone: updatedMilestone };
  } catch (error) {
    console.error("Error modifying manual milestone:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to update milestone",
    };
  }
}

export async function updatePlans(
  updates: Array<{ planId: string; updates: Prisma.PlanUpdateInput }>
) {
  const user = await validateUser();

  try {
    // Validate that all plans belong to the authenticated user
    const planIds = updates.map((update) => update.planId);
    const userPlans = await prisma.plan.findMany({
      where: {
        id: { in: planIds },
        userId: user.id,
      },
    });

    if (userPlans.length !== planIds.length) {
      throw new Error("Not authorized to update some plans");
    }

    // Update all plans in a transaction
    await prisma.$transaction(
      updates.map((update) =>
        prisma.plan.update({
          where: { id: update.planId },
          data: update.updates,
        })
      )
    );

    return { success: true };
  } catch (error) {
    console.error("Error updating plans:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update plans",
    };
  }
}

export async function leavePlan(planId: string) {
  const user = await validateUser();

  try {
    // Verify plan ownership
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
    });

    if (!plan || plan.userId !== user.id) {
      throw new Error("Not authorized to leave this plan");
    }

    // Soft delete the plan by setting deletedAt
    await prisma.plan.update({
      where: { id: planId },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  } catch (error) {
    console.error("Error leaving plan:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to leave plan",
    };
  }
}
