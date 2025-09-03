"use server";

import { validateUser } from "@/lib/server-utils";
import { TZDate } from "@date-fns/tz";
import { Prisma, prisma } from "@tsw/prisma";
import { endOfWeek, startOfWeek } from "date-fns";

export async function getPlans() {
  const user = await validateUser();

  const plans = await prisma.plan.findMany({
    where: {
      userId: user.id,
      deletedAt: null,
    },
    include: {
      activities: true,
      sessions: true,
      planGroup: {
        include: {
          members: true,
        },
      },
      milestones: true,
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  return plans;
}

export async function fetchPlan(
  id: string,
  options?: { includeActivities?: boolean }
) {
  await validateUser();
  const plan = await prisma.plan.findUnique({
    where: { id },
    include: {
      activities: options?.includeActivities ? true : false,
      planGroup: {
        include: {
          members: true,
        },
      },
      sessions: true,
    },
  });
  return plan;
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

export async function fetchPlanInvitation(id: string) {
  await validateUser();

  const planInvitation = await prisma.planInvitation.findUnique({
    where: { id },
  });
  return planInvitation;
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
  const currentDate = new TZDate(new Date(), user.timezone || "UTC");
  const weekStart = startOfWeek(currentDate, {
    weekStartsOn: 0,
  });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });

  // Delete all existing non-coach-suggested sessions for the plan
  await prisma.planSession.deleteMany({
    where: {
      planId: planId,
      isCoachSuggested: false,
      plan: {
        userId: user.id,
      },
      date: {
        gte: weekStart,
        lt: weekEnd,
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
      date: {
        gte: weekStart,
        lt: weekEnd,
      },
    },
    data: {
      isCoachSuggested: false,
    },
  });
}
