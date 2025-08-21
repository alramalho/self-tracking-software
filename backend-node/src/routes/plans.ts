import { Response, Router } from "express";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth";
import { aiService } from "../services/aiService";
import { plansPineconeService } from "../services/pineconeService";
import { recommendationsService } from "../services/recommendationsService";
import { logger } from "../utils/logger";
import { prisma } from "../utils/prisma";

const router = Router();

/**
 * Update plan embedding in Pinecone
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
            sortOrder: planData.sortOrder,

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
      const sessionsResult = await generatePlanSessions({
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
      const planData = req.body;

      // If plan has an ID, it's an update operation
      if (planData.id) {
        // Verify ownership
        const existingPlan = await prisma.plan.findUnique({
          where: { id: planData.id },
        });

        if (!existingPlan || existingPlan.userId !== req.user!.id) {
          return res.status(403).json({
            success: false,
            error: "Not authorized to update this plan",
          });
        }

        // Update the plan
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
            // Connect activities
            ...(planData.activities?.length > 0 && {
              activities: {
                set: [], // Clear existing connections
                connect: planData.activities.map((activity: any) => ({
                  id: activity.id,
                })),
              },
            }),
            // Update milestones if provided
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
          },
          include: {
            activities: true,
            sessions: true,
            milestones: true,
          },
        });

        // Update plan embedding in background
        updatePlanEmbedding(planData.id, req.user!.id);

        // Mark user recommendations as outdated
        markUserRecommendationsOutdated(req.user!.id);

        logger.info(`Updated plan ${planData.id} for user ${req.user!.id}`);
        return res.json({ success: true, plan: updatedPlan });
      } else {
        // Create new plan using existing create-plan logic
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
              sortOrder: planData.sortOrder,

              // Connect activities directly
              ...(planData.activities?.length > 0 && {
                activities: {
                  connect: planData.activities.map((activity: any) => ({
                    id: activity.id,
                  })),
                },
              }),

              // Create milestones directly
              ...(planData.milestones?.length > 0 && {
                milestones: {
                  create: planData.milestones.map((milestone: any) => ({
                    description: milestone.description,
                    date: milestone.date,
                    criteria: milestone.criteria,
                  })),
                },
              }),

              // Create sessions directly
              ...(planData.sessions?.length > 0 && {
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

        // Update plan embedding in background
        updatePlanEmbedding(result.id, req.user!.id);

        // Mark user recommendations as outdated
        markUserRecommendationsOutdated(req.user!.id);

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

// Helper function to generate plan sessions using AI
async function generatePlanSessions(params: {
  goal: string;
  finishingDate?: Date;
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

    const currentDate =
      startDate.toISOString().split("T")[0] +
      ", " +
      startDate.toLocaleDateString("en-US", { weekday: "long" });
    const finishingDateStr = endDate.toISOString().split("T")[0];

    let introduction: string;
    if (params.existingPlan && params.description) {
      // Get existing sessions for context (limit to first 10)
      const existingSessions = params.existingPlan.sessions?.slice(0, 10) || [];
      const sessionContext = existingSessions
        .map((s: any) => {
          const activity = params.activities.find((a) => a.id === s.activityId);
          const sessionDate = new Date(s.date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            weekday: "long",
          });
          return `–${activity?.title || "Unknown"} (${s.quantity} ${activity?.measure || "units"}) on ${sessionDate}`;
        })
        .join("\n");

      introduction = `You are a plan coach assistant. You are coaching with the plan '${params.goal}'
Your task is to generate an adapted plan based on this edit description: \n-${params.description}\n
Here are the CURRENT plan next 10 sessions for reference:
${sessionContext}

You must use this information thoughtfully as the basis for your plan generation. In regards to that:
The plan has the finishing date of ${finishingDateStr} and today is ${currentDate}.
Additional requirements:`;
    } else {
      introduction = `You will act as a personal coach for the goal of ${params.goal}.\nThe plan has the finishing date of ${finishingDateStr} and today is ${currentDate}.`;
    }

    const systemPrompt = `${introduction}
No date should be before today (${currentDate}).
You must develop a progressive plan over the course of ${weeks} weeks.
Keep the activities to a minimum.
The plan should be progressive (intensities or recurrence of activities should increase over time).
The plan should take into account the finishing date and adjust the intensity and/or recurrence of the activities accordingly.
It is an absolute requirement that all present sessions activity names are contained in the list of activities.

Please only include these activities in plan:
${params.activities.map((a) => `- ${a.title} (${a.measure})`).join("\n")}`;

    let userPrompt = `Please generate me a plan to achieve the goal of ${params.goal} by ${finishingDateStr}.`;
    if (params.description) {
      userPrompt += `\nAdditional description: ${params.description}`;
    }

    // Define the schema for AI response
    const { z } = await import("zod");
    const GeneratedSession = z.object({
      date: z.string(),
      activity_name: z
        .string()
        .describe(
          "The name of the activity to be performed. Should have no emoji to match exactly with the activity title."
        ),
      quantity: z
        .number()
        .describe(
          "The quantity of the activity to be performed. Directly related to the activity and should be measured in the same way."
        ),
      descriptive_guide: z.string(),
    });

    const GeneratedSessionWeek = z.object({
      week_number: z.number(),
      reasoning: z
        .string()
        .describe(
          "A step by step thinking outlining the week's outlook given current and leftover progress. Must be deep and reflective."
        ),
      sessions: z
        .array(GeneratedSession)
        .describe("List of sessions for this week."),
    });

    const GenerateSessionsResponse = z.object({
      reasoning: z
        .string()
        .describe(
          "A reflection on what is the goal and how does that affect the sessions progression."
        ),
      weeks: z
        .array(GeneratedSessionWeek)
        .describe("List of weeks with their sessions."),
    });

    // Use AI service to generate structured response
    const response = await aiService.generateStructuredResponse(
      userPrompt,
      GenerateSessionsResponse,
      systemPrompt
    );

    // Convert generated sessions to the expected format
    const sessions = [];
    for (const week of response.weeks) {
      logger.info(
        `Week ${week.week_number}. Has ${week.sessions.length} sessions.`
      );
      for (const session of week.sessions) {
        // Find matching activity
        const activity = params.activities.find(
          (a) => a.title.toLowerCase() === session.activity_name.toLowerCase()
        );

        if (activity) {
          sessions.push({
            date: session.date,
            activityId: activity.id,
            descriptive_guide: session.descriptive_guide,
            quantity: session.quantity,
          });
        }
      }
    }

    return { sessions };
  } catch (error) {
    logger.error("Error in AI session generation:", error);
    // Fallback to basic generation
    return {
      sessions: generateBasicSessions({
        activities: params.activities,
        weeks: Math.ceil(
          (new Date(
            params.finishingDate || Date.now() + 8 * 7 * 24 * 60 * 60 * 1000
          ).getTime() -
            new Date().getTime()) /
            (7 * 24 * 60 * 60 * 1000)
        ),
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
