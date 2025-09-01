import { Response, Router } from "express";
import { z } from "zod/v4";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth";
import { aiService } from "../services/aiService";
import { plansPineconeService } from "../services/pineconeService";
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
  goal: z.string().min(1),
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

router.post(
  "/create-plan",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const planData = req.body;

      // Create everything in a single transaction
      const result = await prisma.$transaction(async (tx) => {
        // Create plan with planGroupId reference
        const newPlan = await tx.plan.create({
          data: {
            userId: req.user!.id,
            goal: planData.goal,
            emoji: planData.emoji,
            finishingDate: planData.finishingDate
              ? new Date(planData.finishingDate)
              : undefined,
            notes: planData.notes,
            durationType: planData.durationType,
            outlineType: planData.outlineType || "SPECIFIC",
            timesPerWeek: planData.timesPerWeek,
            sortOrder: planData.sortOrder,

            // Connect activities directly
            ...(planData.activities?.length > 0 && {
              activities: {
                connect: planData.activities.map((activity: any) => ({
                  id: activity.id,
                })),
              },
            }),

            // Create sessions directly
            ...(planData.sessions?.length > 0 && {
              sessions: {
                create: planData.sessions.map((session: any) => ({
                  activityId: session.activityId,
                  date: session.date,
                  descriptiveGuide: session.descriptive_guide || "",
                  quantity: session.quantity,
                })),
              },
            }),
          },
          include: {
            planGroup: true,
            activities: true,
            sessions: true,
          },
        });

        return newPlan;
      });

      // Update plan embedding in background
      updatePlanEmbedding(result.id, req.user!.id);

      // Mark user recommendations as outdated
      markUserRecommendationsOutdated(req.user!.id);

      logger.info(`Created plan ${result.id} for user ${req.user!.id}`);
      res.status(201).json({
        plan: result,
      });
    } catch (error) {
      logger.error("Error creating plan:", error);
      res.status(500).json({ error: "Failed to create plan" });
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

        const updatedPlan = await prisma.plan.update({
          where: { id: planData.id },
          data: {
            goal: planData.goal,
            emoji: planData.emoji,
            finishingDate: planData.finishingDate,
            notes: planData.notes,
            durationType: planData.durationType,
            outlineType: planData.outlineType || "SPECIFIC",
            timesPerWeek: planData.timesPerWeek,
            sortOrder: planData.sortOrder,
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
        const result = await prisma.$transaction(async (tx) => {
          // Create plan with planGroupId reference
          const newPlan = await tx.plan.create({
            data: {
              id: planData.id,
              userId: req.user!.id,
              goal: planData.goal,
              emoji: planData.emoji,
              finishingDate: planData.finishingDate,
              notes: planData.notes,
              durationType: planData.durationType,
              outlineType: planData.outlineType || "SPECIFIC",
              timesPerWeek: planData.timesPerWeek,
              sortOrder: planData.sortOrder,

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

export const plansRouter: Router = router;
export default plansRouter;
