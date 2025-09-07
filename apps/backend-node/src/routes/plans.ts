import { Response, Router } from "express";
import { z } from "zod/v4";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth";
import { aiService } from "../services/aiService";
import { plansPineconeService } from "../services/pineconeService";
import { plansService } from "../services/plansService";
import { recommendationsService } from "../services/recommendationsService";
import { logger } from "../utils/logger";
import { prisma } from "../utils/prisma";

const router = Router();

// Zod validation schemas
const SessionSchema = z.object({
  activityId: z.string(),
  date: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid datetime string",
  }),
  descriptive_guide: z.string().optional(),
  descriptiveGuide: z.string().optional(),
  quantity: z.number().positive().optional(),
});

const MilestoneSchema = z.object({
  description: z.string().min(1),
  date: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid datetime string",
  }),
  criteria: z.string().optional(),
});

const ActivitySchema = z.object({
  id: z.string(),
});

const PlanUpsertSchema = z.object({
  id: z.string().optional(), // Present for updates, absent for creates
  goal: z.string().min(1).optional(),
  emoji: z.string().optional(),
  finishingDate: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: "Invalid datetime string",
    })
    .nullish(),
  notes: z.string().optional(),
  planGroupId: z.string().optional(),
  durationType: z.enum(["HABIT", "LIFESTYLE", "CUSTOM"]).optional(),
  outlineType: z.enum(["SPECIFIC", "TIMES_PER_WEEK"]).optional(),
  timesPerWeek: z.number().positive().optional(),
  sortOrder: z.number().optional(),
  activities: z.array(ActivitySchema).optional(),
  sessions: z.array(SessionSchema).optional(),
  milestones: z.array(MilestoneSchema).optional(),
  coachNotes: z.string().nullable().optional(),
  suggestedByCoachAt: z.date().nullable().optional(),
  coachSuggestedTimesPerWeek: z.number().positive().nullable().optional(),
});

/**
 * Update plan embedding in Pinecone using readable plan text
 */
async function updatePlanEmbedding(
  planId: string,
  userId: string
): Promise<void> {
  try {
    const readablePlan = await recommendationsService.getReadablePlan(planId);
    if (readablePlan) {
      await plansPineconeService.upsertRecord(readablePlan, planId, {
        user_id: userId,
      });
      logger.info(`Updated plan embedding for plan ${planId}`);
    }
  } catch (error) {
    logger.error(`Failed to update plan embedding for plan ${planId}:`, error);
    // Don't throw the error to avoid breaking plan operations
  }
}

/**
 * Mark user recommendations as outdated after plan changes
 */
async function markUserRecommendationsOutdated(userId: string): Promise<void> {
  try {
    await recommendationsService.markRecommendationsOutdated(userId);
  } catch (error) {
    logger.error(
      `Failed to mark recommendations outdated for user ${userId}:`,
      error
    );
  }
}

/**
 * Update sort orders for plans without sortOrder values
 */
async function updateSortOrders(
  tx: any,
  userId: string,
  excludePlanId?: string
): Promise<void> {
  // Update all other active plans to increase sort order by one
  await tx.plan.updateMany({
    where: {
      userId,
      deletedAt: null,
      id: {
        not: excludePlanId,
      },
      sortOrder: { not: null },
    },
    data: {
      sortOrder: { increment: 1 },
    },
  });

  // First, get the max sortOrder
  const maxSortOrder = await tx.plan.aggregate({
    where: {
      userId,
      deletedAt: null,
      sortOrder: { not: null },
    },
    _max: { sortOrder: true },
  });

  const currentMax = maxSortOrder._max.sortOrder || 0;

  // Find plans without sortOrder
  const plansWithoutSort = await tx.plan.findMany({
    where: {
      userId,
      deletedAt: null,
      sortOrder: null,
      ...(excludePlanId && { id: { not: excludePlanId } }),
    },
    select: { id: true },
  });

  // Update plans without sortOrder sequentially
  for (let i = 0; i < plansWithoutSort.length; i++) {
    await tx.plan.update({
      where: { id: plansWithoutSort[i].id },
      data: { sortOrder: currentMax + i + 1 },
    });
  }
}

// Generate invitation link for external sharing
router.get(
  "/generate-invitation-link",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const { plan_id } = req.query;

      if (!plan_id) {
        return res.status(400).json({ error: "plan_id is required" });
      }

      // Verify plan ownership
      const plan = await prisma.plan.findUnique({
        where: { id: plan_id as string },
      });

      if (!plan || plan.userId !== req.user!.id) {
        return res
          .status(403)
          .json({ error: "Not authorized to generate link for this plan" });
      }

      // Create external invitation record
      const invitation = await prisma.planInvitation.create({
        data: {
          planId: plan_id as string,
          senderId: req.user!.id,
          recipientId: "external", // Special case for external links
        },
      });

      const baseUrl = process.env.FRONTEND_URL || "https://app.tracking.so";
      const link = `${baseUrl}/join-plan/${invitation.id}`;

      logger.info(`Generated invitation link for plan ${plan_id}`);
      res.json({ link });
    } catch (error) {
      logger.error("Error generating invitation link:", error);
      res.status(500).json({ error: "Failed to generate invitation link" });
    }
  }
);

// Remove plan from user
router.delete(
  "/remove-plan/:planId",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const { planId } = req.params;

      // Remove plan from user (implementation depends on User model structure)
      // For now, just mark the plan as deleted or handle via plan group membership
      await prisma.plan.update({
        where: { id: planId },
        data: { deletedAt: new Date() },
      });

      const updatedUser = req.user; // Placeholder - would implement based on actual User model

      logger.info(`Removed plan ${planId} from user ${req.user!.id}`);
      res.json({
        message: "Plan removed from user",
        user: updatedUser,
      });
    } catch (error) {
      logger.error("Error removing plan:", error);
      res.status(500).json({ error: "Failed to remove plan" });
    }
  }
);

// Get user's plans
router.get(
  "/user-plans",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      // Get plans where user is the owner or a member of the plan group
      const plans = await prisma.plan.findMany({
        where: {
          userId: req.user!.id,
          deletedAt: null,
        },
        include: {
          sessions: {
            include: {
              activity: true,
            },
          },
          activities: true,
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      });

      // Transform the data to match expected format
      const transformedPlans = plans.map((plan) => ({
        ...plan,
        activities: plan.activities,
        sessions: plan.sessions.map((session) => ({
          ...session,
          activityId: session.activityId,
          descriptive_guide: session.descriptiveGuide,
        })),
      }));

      logger.info(`Retrieved ${plans.length} plans for user ${req.user!.id}`);
      res.json({ plans: transformedPlans });
    } catch (error) {
      logger.error("Error getting user plans:", error);
      res.status(500).json({ error: "Failed to get user plans" });
    }
  }
);

// Get plan progress including streaks and achievement data
router.get(
  "/:planId/progress",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const { planId } = req.params;
      const userId = req.user!.id;

      const progress = await plansService.getPlanProgress(planId, userId);

      logger.info(`Retrieved progress for plan ${planId}`);
      res.json(progress);
    } catch (error) {
      logger.error("Error getting plan progress:", error);
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to get plan progress" });
      }
    }
  }
);

// Get specific plan
router.get(
  "/:planId",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const { planId } = req.params;

      const plan = await prisma.plan.findUnique({
        where: { id: planId },
        include: {
          sessions: {
            include: {
              activity: true,
            },
          },
          activities: true,
          milestones: true,
        },
      });

      if (!plan) {
        return res.status(404).json({ error: "Plan not found" });
      }

      // Transform the data to match expected format
      const transformedPlan = {
        ...plan,
        activities: plan.activities,
        sessions: plan.sessions.map((session) => ({
          ...session,
          activityId: session.activityId,
          descriptive_guide: session.descriptiveGuide,
        })),
      };

      logger.info(`Retrieved plan ${planId}`);
      res.json(transformedPlan);
    } catch (error) {
      logger.error("Error getting plan:", error);
      res.status(500).json({ error: "Failed to get plan" });
    }
  }
);

// Generate sessions for a plan using AI
router.post(
  "/generate-sessions",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const { goal, finishingDate, activities, description, existing_plan } =
        req.body;

      if (!goal || !activities) {
        return res
          .status(400)
          .json({ error: "goal and activities are required" });
      }

      logger.info(`Generating sessions for plan goal: ${goal}`);

      // Use AI to generate sessions based on goal and activities

      console.log({ finishingDate });
      const sessionsResult = await aiService.generatePlanSessions({
        goal,
        finishingDate,
        activities,
        description,
        existingPlan: existing_plan,
      });

      res.json({ sessions: sessionsResult.sessions });
    } catch (error) {
      logger.error("Error generating sessions:", error);
      res.status(500).json({ error: "Failed to generate sessions" });
    }
  }
);

// Update plan
router.post(
  "/:planId/update",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const { planId } = req.params;
      const { data } = req.body;

      // Verify ownership
      const plan = await prisma.plan.findUnique({
        where: { id: planId },
      });

      if (!plan || plan.userId !== req.user!.id) {
        return res
          .status(403)
          .json({ error: "Not authorized to update this plan" });
      }

      // Update the plan
      const updatedPlan = await prisma.plan.update({
        where: { id: planId },
        data,
      });

      // Update plan embedding in background
      updatePlanEmbedding(planId, req.user!.id);

      // Mark user recommendations as outdated
      markUserRecommendationsOutdated(req.user!.id);

      logger.info(`Updated plan ${planId}`);
      res.json(updatedPlan);
    } catch (error) {
      logger.error("Error updating plan:", error);
      res.status(500).json({ error: "Failed to update plan" });
    }
  }
);

// Upsert plan (create or update)
router.post(
  "/upsert",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Validate request body with Zod
      const validationResult = PlanUpsertSchema.safeParse(req.body);

      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: "Invalid request data",
          details: validationResult.error.issues,
        });
      }

      const planData: z.infer<typeof PlanUpsertSchema> = validationResult.data;

      let existingPlan;
      if (planData.id) {
        existingPlan = await prisma.plan.findUnique({
          where: { id: planData.id },
        });
      }

      if (existingPlan) {
        // is update operation
        if (existingPlan.userId !== req.user!.id) {
          return res.status(403).json({
            success: false,
            error: "Not authorized to update this plan",
          });
        }

        const { milestones, sessions, activities, ...plan } = planData;

        const updatedPlan = await prisma.plan.update({
          where: { id: planData.id },
          data: {
            ...plan,
            deletedAt: null,
            ...(planData.milestones && {
              milestones: {
                deleteMany: {}, // Clear existing milestones
                create: planData.milestones.map((milestone: any) => ({
                  description: milestone.description,
                  date: milestone.date,
                  criteria: milestone.criteria,
                })),
              },
            }),
            // Update sessions if provided
            ...(planData.sessions && {
              sessions: {
                deleteMany: {}, // Clear existing sessions
                create: planData.sessions.map((session: any) => ({
                  activityId: session.activityId,
                  date: session.date,
                  descriptiveGuide:
                    session.descriptive_guide || session.descriptiveGuide || "",
                  quantity: session.quantity,
                })),
              },
            }),
            ...(planData.activities && {
              activities: {
                set: [], // Clear existing connections
                connect: planData.activities.map((activity: any) => ({
                  id: typeof activity === "string" ? activity : activity.id,
                })),
              },
            }),
            planGroupId: planData.planGroupId,
          },
          include: {
            activities: true,
            sessions: true,
            milestones: true,
          },
        });
        // Mark user recommendations as outdated
        recommendationsService.computeRecommendedUsers(req.user!.id);

        logger.info(`Updated plan ${planData.id} for user ${req.user!.id}`);
        return res.json({ success: true, plan: updatedPlan });
      } else {
        // Create new plan using existing create-plan logic
        if (!planData.goal) {
          return res.status(400).json({
            success: false,
            error: "Goal is required",
          });
        }

        const result = await prisma.$transaction(async (tx) => {
          // Create plan with planGroupId reference
          const newPlan = await tx.plan.create({
            data: {
              id: planData.id || undefined,
              userId: req.user!.id,
              goal: planData.goal!,
              emoji: planData.emoji,
              finishingDate: planData.finishingDate,
              notes: planData.notes,
              durationType: planData.durationType,
              outlineType: planData.outlineType || "SPECIFIC",
              timesPerWeek: planData.timesPerWeek,
              sortOrder: 1,

              // Connect activities directly - handle both activities array and activityIds array
              ...(planData.activities && {
                activities: {
                  connect: planData.activities.map((activity: any) => ({
                    id: typeof activity === "string" ? activity : activity.id,
                  })),
                },
              }),

              // Create milestones directly
              ...(planData.milestones && {
                milestones: {
                  create: planData.milestones.map((milestone: any) => ({
                    description: milestone.description,
                    date: milestone.date,
                    criteria: milestone.criteria,
                  })),
                },
              }),

              // Create sessions directly
              ...(planData.sessions && {
                sessions: {
                  create: planData.sessions.map((session: any) => ({
                    activityId: session.activityId,
                    date: session.date,
                    descriptiveGuide:
                      session.descriptive_guide ||
                      session.descriptiveGuide ||
                      "",
                    quantity: session.quantity,
                  })),
                },
              }),
            },
            include: {
              planGroup: true,
              activities: true,
              sessions: true,
              milestones: true,
            },
          });

          // Update sort orders for plans without sortOrder
          await updateSortOrders(tx, req.user!.id, newPlan.id);

          return newPlan;
        });

        updatePlanEmbedding(result.id, req.user!.id);

        // Mark user recommendations as outdated
        recommendationsService.computeRecommendedUsers(req.user!.id);

        logger.info(`Created plan ${result.id} for user ${req.user!.id}`);
        return res.json({ success: true, plan: result });
      }
    } catch (error) {
      logger.error("Error upserting plan:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to save plan",
      });
    }
  }
);

// Accept plan invitation
router.post(
  "/accept-plan-invitation/:invitationId",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const { invitationId } = req.params;
      const { activity_associations = [] } = req.body;

      let invitation = await prisma.planInvitation.findUnique({
        where: { id: invitationId },
        include: {
          plan: {
            include: {
              planGroup: true,
              activities: true,
            },
          },
        },
      });

      if (!invitation) {
        return res.status(404).json({ error: "Invitation not found" });
      }

      // Handle external invitations by creating a new invitation for the current user
      if (invitation.recipientId === "external") {
        logger.info(
          `Plan invitation recipient is external, creating new invitation for user ${req.user!.id}`
        );

        // Check if invitation already exists for this user
        const existingInvitation = await prisma.planInvitation.findFirst({
          where: {
            planId: invitation.planId,
            senderId: invitation.senderId,
            recipientId: req.user!.id,
          },
          include: {
            plan: {
              include: {
                planGroup: true,
                activities: true,
              },
            },
          },
        });

        if (existingInvitation) {
          invitation = existingInvitation;
        } else {
          invitation = await prisma.planInvitation.create({
            data: {
              planId: invitation.planId,
              senderId: invitation.senderId,
              recipientId: req.user!.id,
              status: "PENDING",
            },
            include: {
              plan: {
                include: {
                  planGroup: true,
                  activities: true,
                },
              },
            },
          });
        }
      }

      // Verify the invitation is for the current user
      if (invitation.recipientId !== req.user!.id) {
        return res
          .status(403)
          .json({ error: "Not authorized to accept this invitation" });
      }

      // Accept the invitation using a transaction
      const result = await prisma.$transaction(async (tx) => {
        // Update invitation status
        await tx.planInvitation.update({
          where: { id: invitation!.id },
          data: { status: "ACCEPTED" },
        });

        const plan = invitation!.plan;

        // Create a copy of the plan for the new user
        const newPlan = await tx.plan.create({
          data: {
            userId: req.user!.id,
            goal: plan.goal,
            emoji: plan.emoji,
            finishingDate: plan.finishingDate,
            notes: plan.notes,
            durationType: plan.durationType,
            outlineType: plan.outlineType,
            timesPerWeek: plan.timesPerWeek,
            sortOrder: 1,
            planGroupId: plan.planGroupId,
            // Connect activities based on activity_associations or use original plan's activities
            activities: {
              connect:
                activity_associations.length > 0
                  ? activity_associations.map((assoc: any) => ({
                      id: assoc.user_activity_id,
                    }))
                  : plan.activities.map((activity: any) => ({
                      id: activity.id,
                    })),
            },
          },
          include: {
            activities: true,
            sessions: true,
            milestones: true,
            planGroup: true,
          },
        });

        // Update plan group if it exists to include the new plan
        if (plan.planGroupId) {
          await tx.planGroup.update({
            where: { id: plan.planGroupId },
            data: {
              members: {
                connect: { id: req.user!.id },
              },
              plans: {
                connect: { id: newPlan.id },
              },
            },
          });
        }

        // Update sort orders for other plans
        await updateSortOrders(tx, req.user!.id, newPlan.id);

        return newPlan;
      });

      logger.info(
        `User ${req.user!.id} accepted plan invitation ${invitationId}`
      );
      res.json({
        message: "Invitation accepted successfully",
        plan: result,
      });
    } catch (error) {
      logger.error("Error accepting plan invitation:", error);
      res.status(500).json({ error: "Failed to accept plan invitation" });
    }
  }
);

// Reject plan invitation
router.post(
  "/reject-plan-invitation/:invitationId",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const { invitationId } = req.params;

      let invitation = await prisma.planInvitation.findUnique({
        where: { id: invitationId },
      });

      if (!invitation) {
        return res.status(404).json({ error: "Invitation not found" });
      }

      // Handle external invitations by creating a new invitation for the current user
      if (invitation.recipientId === "external") {
        logger.info(
          `Plan invitation recipient is external, creating new invitation for user ${req.user!.id}`
        );

        // Check if invitation already exists for this user
        const existingInvitation = await prisma.planInvitation.findFirst({
          where: {
            planId: invitation.planId,
            senderId: invitation.senderId,
            recipientId: req.user!.id,
          },
        });

        if (existingInvitation) {
          invitation = existingInvitation;
        } else {
          invitation = await prisma.planInvitation.create({
            data: {
              planId: invitation.planId,
              senderId: invitation.senderId,
              recipientId: req.user!.id,
              status: "PENDING",
            },
          });
        }
      }

      // Verify the invitation is for the current user
      if (invitation.recipientId !== req.user!.id) {
        return res
          .status(403)
          .json({ error: "Not authorized to reject this invitation" });
      }

      // Update invitation status to rejected
      await prisma.planInvitation.update({
        where: { id: invitation.id },
        data: { status: "REJECTED" },
      });

      logger.info(
        `User ${req.user!.id} rejected plan invitation ${invitationId}`
      );
      res.json({ message: "Invitation rejected successfully" });
    } catch (error) {
      logger.error("Error rejecting plan invitation:", error);
      res.status(500).json({ error: "Failed to reject plan invitation" });
    }
  }
);

export const plansRouter: Router = router;
export default plansRouter;
