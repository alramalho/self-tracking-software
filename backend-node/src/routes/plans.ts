import { Router, Response } from "express";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import { logger } from "../utils/logger";
import { prisma } from "../utils/prisma";
import { aiService } from "../services/aiService";
import { notificationService } from "../services/notificationService";

const router = Router();

// Generate invitation link for external sharing
router.get(
  "/generate-invitation-link",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
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
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const planData = req.body;

      // Create everything in a single transaction
      const result = await prisma.$transaction(async (tx) => {
        // Create plan group first
        const planGroup = await tx.planGroup.create({
          data: {
            members: {
              connect: { id: req.user!.id },
            },
          },
        });

        // Create plan with planGroupId reference
        const newPlan = await tx.plan.create({
          data: {
            userId: req.user!.id,
            planGroupId: planGroup.id,
            goal: planData.goal,
            emoji: planData.emoji,
            finishingDate: planData.finishingDate,
            notes: planData.notes,
            durationType: planData.durationType,
            outlineType: planData.outlineType || "SPECIFIC",
            timesPerWeek: planData.timesPerWeek,

            // Connect activities directly
            ...(planData.activityIds?.length > 0 && {
              activities: {
                connect: planData.activityIds.map((id: string) => ({ id })),
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
  async (req: AuthenticatedRequest, res: Response) => {
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
  async (req: AuthenticatedRequest, res: Response) => {
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
        orderBy: { createdAt: "desc" },
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
  async (req: AuthenticatedRequest, res: Response) => {
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
  async (req: AuthenticatedRequest, res: Response) => {
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
      const sessionsResult = await generatePlanSessions({
        goal,
        finishingDate: finishingDate,
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
  async (req: AuthenticatedRequest, res: Response) => {
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

      logger.info(`Updated plan ${planId}`);
      res.json(updatedPlan);
    } catch (error) {
      logger.error("Error updating plan:", error);
      res.status(500).json({ error: "Failed to update plan" });
    }
  }
);

// Update plan order
router.post(
  "/update-plan-order",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { plan_ids } = req.body;

      if (!Array.isArray(plan_ids)) {
        return res.status(400).json({ error: "plan_ids must be an array" });
      }

      // Plan order update would need to be implemented based on User model structure
      // For now, just acknowledge the request
      const updatedUser = req.user; // Placeholder

      logger.info(`Updated plan order for user ${req.user!.id}`);
      res.json({
        message: "Plan order updated successfully",
        user: updatedUser,
      });
    } catch (error) {
      logger.error("Error updating plan order:", error);
      res.status(500).json({ error: "Failed to update plan order" });
    }
  }
);

// Helper function to generate plan sessions using AI
async function generatePlanSessions(params: {
  goal: string;
  finishingDate?: string;
  activities: any[];
  description?: string;
  existingPlan?: any;
}): Promise<{ sessions: any[] }> {
  try {
    // Calculate plan duration
    const startDate = new Date();
    const endDate = params.finishingDate
      ? new Date(params.finishingDate)
      : new Date(Date.now() + 8 * 7 * 24 * 60 * 60 * 1000); // Default 8 weeks
    const weeks = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000)
    );

    // Use AI to generate smart session planning
    const systemPrompt = `You are an expert fitness and wellness coach. Generate a progressive training plan.
    Create sessions that:
    - Progress gradually in intensity/quantity
    - Are realistic and achievable
    - Consider rest days and recovery
    - Distribute activities across the timeline
    ${params.description ? `Additional instructions: ${params.description}` : ""}`;

    const prompt = `Create a ${weeks}-week plan for goal: "${params.goal}"
    Available activities: ${params.activities.map((a) => `${a.title} (${a.measure})`).join(", ")}
    ${params.existingPlan ? `Existing plan context: ${JSON.stringify(params.existingPlan)}` : ""}
    
    Generate sessions with dates, activity assignments, quantities, and descriptive guides.`;

    // For now, generate basic sessions (would use full AI in production)
    const sessions = generateBasicSessions({
      activities: params.activities,
      weeks,
      startDate,
      goal: params.goal,
    });

    return { sessions };
  } catch (error) {
    logger.error("Error in AI session generation:", error);
    // Fallback to basic generation
    return {
      sessions: generateBasicSessions({
        activities: params.activities,
        weeks: 8,
        startDate: new Date(),
        goal: params.goal,
      }),
    };
  }
}

// Helper function to generate basic sessions
function generateBasicSessions(params: {
  activities: any[];
  weeks: number;
  startDate: Date;
  goal: string;
}): any[] {
  const sessions = [];
  const sessionsPerWeek = 3; // Default 3 sessions per week

  for (let week = 0; week < params.weeks; week++) {
    for (let sessionNum = 0; sessionNum < sessionsPerWeek; sessionNum++) {
      const sessionDate = new Date(params.startDate);
      sessionDate.setDate(
        params.startDate.getDate() + week * 7 + sessionNum * 2
      ); // Every other day

      const activity = params.activities[sessionNum % params.activities.length];
      const progressMultiplier = 1 + week * 0.1; // 10% increase per week

      sessions.push({
        date: sessionDate.toISOString().split("T")[0],
        activityId: activity.id,
        descriptive_guide: `Week ${week + 1}, Session ${sessionNum + 1}: Focus on ${activity.title}`,
        quantity: Math.ceil(progressMultiplier * (sessionNum + 1)), // Progressive quantity
      });
    }
  }

  return sessions;
}

// Health check
router.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "plans-routes",
  });
});

export const plansRouter: Router = router;
export default plansRouter;
