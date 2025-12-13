import { TZDate } from "@date-fns/tz";
import { Activity, Plan, PlanGroup, PlanState, Prisma } from "@tsw/prisma";
import { endOfWeek, startOfWeek } from "date-fns";
import { Response, Router } from "express";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod/v4";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth";
import { aiService } from "../services/aiService";
import { plansService } from "../services/plansService";
import { recommendationsService } from "../services/recommendationsService";
import { s3Service } from "../services/s3Service";
import { logger } from "../utils/logger";
import { prisma } from "../utils/prisma";

const router = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (_req, file, cb) => {
    // Accept images only
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Only image files are allowed"));
      return;
    }
    cb(null, true);
  },
});

const PlanBulkUpdateSchema = z.object({
  updates: z.array(
    z.object({
      planId: z.string(),
      updates: z.record(z.string(), z.any()),
    })
  ),
});

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
  isCoached: z.boolean().optional(),
  activities: z.array(ActivitySchema).optional(),
  sessions: z.array(SessionSchema).optional(),
  milestones: z.array(MilestoneSchema).optional(),
  coachNotes: z.string().nullable().optional(),
  suggestedByCoachAt: z.date().nullable().optional(),
  coachSuggestedTimesPerWeek: z.number().positive().nullable().optional(),
  deletedAt: z.iso.datetime().nullable().optional(),
  visibility: z.enum(["PUBLIC", "PRIVATE", "FRIENDS"]).optional(),
  backgroundImageUrl: z.string().url().nullable().optional(),
  progressState: z.any().nullable().optional(),
});

/**
 * Update plan embedding using the plansService
 */
async function updatePlanEmbedding(planId: string): Promise<void> {
  try {
    await plansService.updatePlanEmbedding(planId);
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
 * Ensure only one plan is coached at a time
 * If isCoached is being set to true, uncoach all other plans
 */
async function ensureSingleCoachedPlan(
  tx: any,
  userId: string,
  planId: string,
  isCoached: boolean
): Promise<void> {
  if (isCoached) {
    // Uncoach all other plans for this user
    await tx.plan.updateMany({
      where: {
        userId,
        deletedAt: null,
        id: { not: planId },
        isCoached: true,
      },
      data: {
        isCoached: false,
      },
    });
  }
}

// Get user's plans
router.get(
  "/",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const plans = await prisma.plan.findMany({
        where: {
          userId: req.user!.id,
          deletedAt: null,
        },
        include: {
          activities: {
            where: {
              deletedAt: null,
            },
          },
          sessions: true,
          planGroup: {
            include: {
              members: {
                where: {
                  status: "ACTIVE",
                },
                include: {
                  user: {
                    select: {
                      id: true,
                      name: true,
                      username: true,
                      picture: true,
                    },
                  },
                  plan: {
                    select: {
                      id: true,
                      goal: true,
                    },
                  },
                },
              },
            },
          },
          milestones: true,
        },
        orderBy: [{ createdAt: "desc" }],
      });

      // Batch load progress for all plans
      const planIds = plans.map((p) => p.id);
      const plansProgress = await plansService.getBatchPlanProgress(
        planIds,
        req.user!.id,
        false // Use cache
      );

      // Create progress map for fast lookup
      const progressMap = new Map(plansProgress.map((p) => [p.plan.id, p]));

      // Augment each plan with progress data
      const plansWithProgress = plans.map((plan) => ({
        ...plan,
        progress: progressMap.get(plan.id),
      }));

      res.json(plansWithProgress);
    } catch (error) {
      logger.error("Error fetching plans:", error);
      res.status(500).json({ error: "Failed to fetch plans" });
    }
  }
);

// Upload plan background image
router.post(
  "/upload-background-image",
  requireAuth,
  upload.single("image"),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          error: "No image file provided",
        });
        return;
      }

      // Generate unique file key
      const fileExtension = req.file.mimetype.split("/")[1];
      const key = `/users/${req.user!.id}/plan-backgrounds/${uuidv4()}.${fileExtension}`;

      // Upload to S3 (public access controlled by bucket policy)
      await s3Service.upload(req.file.buffer, key, req.file.mimetype);

      // Get public URL
      const publicUrl = s3Service.getPublicUrl(key);

      res.json({
        success: true,
        url: publicUrl,
      });
    } catch (error) {
      logger.error("Failed to upload plan background image:", error);
      res.status(500).json({
        success: false,
        error: "Failed to upload background image",
      });
    }
  }
);

// Invite a user to a plan (within-app invitation)
router.post(
  "/invite-to-plan",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { planId, recipientId } = req.body;

      if (!planId || !recipientId) {
        res.status(400).json({ error: "planId and recipientId are required" });
        return;
      }

      // Verify plan ownership
      const plan = await prisma.plan.findUnique({
        where: { id: planId },
      });

      if (!plan || plan.userId !== req.user!.id) {
        res
          .status(403)
          .json({ error: "Not authorized to invite to this plan" });
        return;
      }

      // Verify recipient exists
      const recipient = await prisma.user.findUnique({
        where: { id: recipientId },
      });

      if (!recipient) {
        res.status(404).json({ error: "Recipient user not found" });
        return;
      }

      // Create or get plan group
      let planGroupId = plan.planGroupId;
      if (!planGroupId) {
        const planGroup = await prisma.planGroup.create({
          data: {},
        });
        planGroupId = planGroup.id;

        // Update plan with new planGroupId
        await prisma.plan.update({
          where: { id: planId },
          data: { planGroupId },
        });

        // Create owner membership for the plan creator
        await prisma.planGroupMember.create({
          data: {
            planGroupId,
            userId: req.user!.id,
            planId: planId,
            role: "OWNER",
            status: "ACTIVE",
            joinedAt: new Date(),
          },
        });
      }

      // Check if user is already a member or was previously invited
      const existingMember = await prisma.planGroupMember.findUnique({
        where: {
          planGroupId_userId: {
            planGroupId,
            userId: recipientId,
          },
        },
      });

      let invitation;

      if (existingMember) {
        // If already ACTIVE or INVITED, reject the new invitation
        if (
          existingMember.status === "ACTIVE" ||
          existingMember.status === "INVITED"
        ) {
          res
            .status(400)
            .json({ error: "User already invited or is a member" });
          return;
        }

        // If LEFT or REJECTED, update the existing record to INVITED (re-invitation)
        invitation = await prisma.planGroupMember.update({
          where: { id: existingMember.id },
          data: {
            status: "INVITED",
            invitedById: req.user!.id,
            invitedAt: new Date(),
            leftAt: null,
          },
          include: {
            planGroup: {
              include: {
                plans: true,
              },
            },
            invitedBy: true,
          },
        });
      } else {
        // Create new invitation (PlanGroupMember with INVITED status)
        invitation = await prisma.planGroupMember.create({
          data: {
            planGroupId,
            userId: recipientId,
            invitedById: req.user!.id,
            role: "MEMBER",
            status: "INVITED",
          },
          include: {
            planGroup: {
              include: {
                plans: true,
              },
            },
            invitedBy: true,
          },
        });
      }

      // Create notification for recipient
      await prisma.notification.create({
        data: {
          userId: recipientId,
          message: `${req.user!.name || req.user!.username || "Someone"} invited you to join their plan: ${plan.goal}`,
          type: "PLAN_INVITATION",
          relatedId: invitation.id,
          relatedData: {
            planGroupId,
            planGoal: plan.goal,
            inviterId: req.user!.id,
          },
        },
      });

      logger.info(
        `User ${req.user!.id} invited user ${recipientId} to plan ${planId}`
      );
      res.json({ success: true, invitation });
    } catch (error) {
      logger.error("Error inviting user to plan:", error);
      res.status(500).json({ error: "Failed to invite user to plan" });
    }
  }
);

// Retrieve a plan group member invitation by id
router.get(
  "/plan-invitations/:invitationId",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { invitationId } = req.params;
      const invitation = await prisma.planGroupMember.findUnique({
        where: { id: invitationId },
        include: {
          planGroup: {
            include: {
              plans: {
                include: {
                  activities: true,
                },
              },
            },
          },
          invitedBy: true,
        },
      });

      if (!invitation) {
        res.status(404).json({ error: "Plan invitation not found" });
        return;
      }

      res.json(invitation);
    } catch (error) {
      logger.error("Error fetching plan invitation:", error);
      res.status(500).json({ error: "Failed to fetch plan invitation" });
    }
  }
);

// Generate invitation link for external sharing
router.get(
  "/generate-invitation-link",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { plan_id } = req.query;

      if (!plan_id) {
        res.status(400).json({ error: "plan_id is required" });
        return;
      }

      // Verify plan ownership
      const plan = await prisma.plan.findUnique({
        where: { id: plan_id as string },
      });

      if (!plan || plan.userId !== req.user!.id) {
        res
          .status(403)
          .json({ error: "Not authorized to generate link for this plan" });
        return;
      }

      // Create or get plan group
      let planGroupId = plan.planGroupId;
      if (!planGroupId) {
        const planGroup = await prisma.planGroup.create({
          data: {},
        });
        planGroupId = planGroup.id;

        // Update plan with new planGroupId
        await prisma.plan.update({
          where: { id: plan_id as string },
          data: { planGroupId },
        });

        // Create owner membership for the plan creator
        await prisma.planGroupMember.create({
          data: {
            planGroupId,
            userId: req.user!.id,
            planId: plan_id as string,
            role: "OWNER",
            status: "ACTIVE",
            joinedAt: new Date(),
          },
        });
      }

      // Create external invitation link
      const inviteLink = await prisma.planInviteLink.create({
        data: {
          planGroupId,
          createdById: req.user!.id,
          isActive: true,
        },
      });

      const baseUrl = process.env.FRONTEND_URL || "https://app.tracking.so";
      const link = `${baseUrl}/join-plan/${inviteLink.id}`;

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
        orderBy: [{ createdAt: "desc" }],
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

// Get progress for multiple plans (cached)
router.post(
  "/batch-progress",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const { planIds, forceRecompute = false } = req.body;

      if (!planIds || !Array.isArray(planIds)) {
        res.status(400).json({
          error: "planIds array is required",
        });
        return;
      }

      const userId = req.user!.id;
      const progressData = await plansService.getBatchPlanProgress(
        planIds,
        userId,
        forceRecompute
      );

      logger.info(
        `Retrieved batch progress for ${planIds.length} plans${forceRecompute ? " (forced recompute)" : ""}`
      );
      res.json({ progress: progressData });
    } catch (error) {
      logger.error("Error getting batch plan progress:", error);
      res.status(500).json({ error: "Failed to get batch plan progress" });
    }
  }
);

// Compute progress for multiple plans (always fresh)
router.post(
  "/batch-progress/compute",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const { planIds } = req.body;

      if (!planIds || !Array.isArray(planIds)) {
        res.status(400).json({
          error: "planIds array is required",
        });
        return;
      }

      const userId = req.user!.id;
      const progressData = await plansService.getBatchPlanProgress(
        planIds,
        userId,
        true // Force recompute
      );

      logger.info(`Computed fresh batch progress for ${planIds.length} plans`);
      res.json({ progress: progressData });
    } catch (error) {
      logger.error("Error computing batch plan progress:", error);
      res.status(500).json({ error: "Failed to compute batch plan progress" });
    }
  }
);

// Get progress for single plan (cached)
router.get(
  "/:planId/progress",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const { planId } = req.params;
      const forceRecompute = req.query.forceRecompute === "true";

      const plan = await prisma.plan.findUnique({
        where: { id: planId },
        include: { activities: true },
      });

      if (!plan || plan.userId !== req.user!.id) {
        res.status(404).json({ error: "Plan not found" });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
      });

      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      const progressData = forceRecompute
        ? await plansService.computePlanProgress(plan, user)
        : await plansService.getPlanProgress(plan, user);

      logger.info(
        `Retrieved progress for plan ${planId}${forceRecompute ? " (forced recompute)" : ""}`
      );
      res.json(progressData);
    } catch (error) {
      logger.error("Error getting plan progress:", error);
      res.status(500).json({ error: "Failed to get plan progress" });
    }
  }
);

// Compute progress for single plan (always fresh)
router.post(
  "/:planId/progress/compute",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const { planId } = req.params;

      const plan = await prisma.plan.findUnique({
        where: { id: planId },
        include: { activities: true },
      });

      if (!plan || plan.userId !== req.user!.id) {
        res.status(404).json({ error: "Plan not found" });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
      });

      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      const progressData = await plansService.computePlanProgress(plan, user);

      logger.info(`Computed fresh progress for plan ${planId}`);
      res.json(progressData);
    } catch (error) {
      logger.error("Error computing plan progress:", error);
      res.status(500).json({ error: "Failed to compute plan progress" });
    }
  }
);

// Get plan group progress comparison for all members
router.get(
  "/:planId/group-progress",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const { planId } = req.params;

      // Get the plan with group info
      const plan = await prisma.plan.findUnique({
        where: { id: planId },
        include: {
          planGroup: {
            include: {
              members: {
                where: {
                  status: "ACTIVE",
                },
                include: {
                  user: {
                    select: {
                      id: true,
                      name: true,
                      username: true,
                      picture: true,
                      planType: true,
                      timezone: true,
                    },
                  },
                  plan: {
                    include: {
                      activities: true,
                      sessions: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!plan) {
        res.status(404).json({ error: "Plan not found" });
        return;
      }

      if (!plan.planGroup) {
        res.status(400).json({ error: "Plan is not part of a group" });
        return;
      }

      // Check if user is member of this plan group
      const isMember = plan.planGroup.members.some(
        (m) => m.userId === req.user!.id
      );
      if (!isMember) {
        res.status(403).json({ error: "Not authorized to view this group" });
        return;
      }

      // Calculate progress for each member
      const memberProgress = await Promise.all(
        plan.planGroup.members.map(async (member) => {
          if (!member.plan) {
            return null;
          }

          const user = member.user;
          const memberPlan = member.plan;

          // Check if this is a coached plan
          // Coached = user is PLUS AND plan has isCoached flag set
          let isCoached = false;
          if (user.planType === "PLUS") {
            isCoached = (memberPlan as any).isCoached || false;
          }

          // Get current week's activity count
          const timezone = user.timezone || "UTC";
          const currentDate = new TZDate(new Date(), timezone);
          const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
          const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });

          const activityIds = memberPlan.activities.map((a) => a.id);
          const weeklyActivityCount = await prisma.activityEntry.count({
            where: {
              userId: user.id,
              activityId: { in: activityIds },
              datetime: {
                gte: weekStart,
                lte: weekEnd,
              },
              deletedAt: null,
            },
          });

          // Calculate target
          let target = memberPlan.timesPerWeek || 0;
          if (target === 0 && memberPlan.outlineType === "SPECIFIC") {
            // Count sessions in current week
            const weekSessions = memberPlan.sessions.filter((s) => {
              const sessionDate = new TZDate(s.date, timezone);
              return sessionDate >= weekStart && sessionDate <= weekEnd;
            });
            target = weekSessions.length;
          }

          // Determine status - use currentWeekState as-is (can be null)
          let status: PlanState | null = null;
          if (isCoached) {
            status = memberPlan.currentWeekState;
          }

          return {
            userId: user.id,
            name: user.name || user.username || "Unknown",
            username: user.username,
            picture: user.picture,
            planId: memberPlan.id,
            weeklyActivityCount,
            target,
            isCoached,
            status,
          };
        })
      );

      // Filter out null entries
      const validProgress = memberProgress.filter((p) => p !== null);

      logger.info(`Retrieved group progress for plan ${planId}`);
      res.json({
        planGroupId: plan.planGroupId,
        members: validProgress,
      });
    } catch (error) {
      logger.error("Error getting group progress:", error);
      res.status(500).json({ error: "Failed to get group progress" });
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
      const includeActivities = req.query.includeActivities === "true";

      const plan = await prisma.plan.findUnique({
        where: { id: planId },
        include: {
          sessions: {
            include: {
              activity: true,
            },
          },
          activities: includeActivities ? true : false,
          milestones: true,
          planGroup: {
            include: {
              members: {
                where: {
                  status: "ACTIVE",
                },
                include: {
                  user: {
                    select: {
                      id: true,
                      name: true,
                      username: true,
                      picture: true,
                    },
                  },
                  plan: {
                    select: {
                      id: true,
                      goal: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!plan) {
        res.status(404).json({ error: "Plan not found" });
        return;
      }

      // Transform the data to match expected format
      logger.info(`Retrieved plan ${planId}`);
      res.json(plan);
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
      const {
        goal,
        finishingDate,
        activities,
        description,
        existing_plan,
        // New parameters for research-based pipeline
        experience,
        timesPerWeek,
      } = req.body;

      if (!goal || !activities) {
        res.status(400).json({ error: "goal and activities are required" });
        return;
      }

      logger.info(`Generating sessions for plan goal: ${goal}`);

      // Fetch user age for the research-based pipeline
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { age: true },
      });

      console.log({ finishingDate });
      const sessionsResult = await aiService.generatePlanSessions({
        goal,
        finishingDate,
        activities,
        description,
        existingPlan: existing_plan,
        // New parameters for the 3-stage pipeline
        userAge: user?.age ?? null,
        experience,
        timesPerWeek,
      });

      res.json({
        sessions: sessionsResult.sessions,
        // Optionally include research findings for debugging/display
        researchFindings: sessionsResult.researchFindings,
      });
    } catch (error) {
      logger.error("Error generating sessions:", error);
      res.status(500).json({ error: "Failed to generate sessions" });
    }
  }
);

// Bulk update plans
router.patch(
  "/bulk-update",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const validationResult = PlanBulkUpdateSchema.safeParse(req.body);

      if (!validationResult.success) {
        res.status(400).json({
          success: false,
          error: "Invalid request data",
          details: validationResult.error.issues,
        });
        return;
      }

      const { updates } = validationResult.data;
      const planIds = updates.map((update) => update.planId);

      const userPlans = await prisma.plan.findMany({
        where: {
          id: { in: planIds },
          userId: req.user!.id,
        },
      });

      if (userPlans.length !== planIds.length) {
        res.status(403).json({
          success: false,
          error: "Not authorized to update some plans",
        });
        return;
      }

      await prisma.$transaction(
        updates.map((update) =>
          prisma.plan.update({
            where: { id: update.planId },
            data: update.updates as Prisma.PlanUpdateInput,
          })
        )
      );

      res.json({ success: true });
    } catch (error) {
      logger.error("Error updating plans:", error);
      res.status(500).json({ error: "Failed to update plans" });
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
        res.status(403).json({ error: "Not authorized to update this plan" });
        return;
      }

      // Update the plan
      const updatedPlan = await prisma.plan.update({
        where: { id: planId },
        data,
      });

      // Update plan embedding in background
      updatePlanEmbedding(planId);

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

// Modify manual milestone progress
router.post(
  "/milestones/:milestoneId/modify",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { milestoneId } = req.params;
      const { delta } = req.body as { delta?: number };

      if (typeof delta !== "number") {
        res.status(400).json({ error: "delta must be a number" });
        return;
      }

      const milestone = await prisma.planMilestone.findFirst({
        where: {
          id: milestoneId,
          plan: {
            userId: req.user!.id,
          },
        },
      });

      if (!milestone) {
        res.status(404).json({ error: "Milestone not found" });
        return;
      }

      const currentProgress = milestone.progress ?? 0;
      const newProgress = Math.min(Math.max(currentProgress + delta, 0), 100);

      const updatedMilestone = await prisma.planMilestone.update({
        where: { id: milestoneId },
        data: { progress: newProgress },
      });

      res.json({ success: true, milestone: updatedMilestone });
    } catch (error) {
      logger.error("Error modifying milestone:", error);
      res.status(500).json({ error: "Failed to modify milestone" });
    }
  }
);

// Clear coach suggested sessions for a plan
router.post(
  "/:planId/clear-coach-suggested-sessions",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { planId } = req.params;

      const plan = await prisma.plan.findFirst({
        where: {
          id: planId,
          userId: req.user!.id,
        },
      });

      if (!plan) {
        res.status(404).json({ error: "Plan not found" });
        return;
      }

      await prisma.planSession.deleteMany({
        where: {
          planId,
          isCoachSuggested: true,
          plan: {
            userId: req.user!.id,
          },
        },
      });

      res.json({ success: true });
    } catch (error) {
      logger.error("Error clearing coach suggested sessions:", error);
      res
        .status(500)
        .json({ error: "Failed to clear coach suggested sessions" });
    }
  }
);

// Upgrade coach suggested sessions to plan sessions
router.post(
  "/:planId/upgrade-coach-suggested-sessions",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { planId } = req.params;

      const plan = await prisma.plan.findFirst({
        where: {
          id: planId,
          userId: req.user!.id,
        },
      });

      if (!plan) {
        res.status(404).json({ error: "Plan not found" });
        return;
      }

      const timezone = req.user?.timezone || "UTC";
      const currentDate = new TZDate(new Date(), timezone);
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });

      await prisma.planSession.deleteMany({
        where: {
          planId,
          isCoachSuggested: false,
          plan: {
            userId: req.user!.id,
          },
          date: {
            gte: weekStart,
            lt: weekEnd,
          },
        },
      });

      await prisma.planSession.updateMany({
        where: {
          planId,
          isCoachSuggested: true,
          plan: {
            userId: req.user!.id,
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

      res.json({ success: true });
    } catch (error) {
      logger.error("Error upgrading coach suggested sessions:", error);
      res
        .status(500)
        .json({ error: "Failed to upgrade coach suggested sessions" });
    }
  }
);

// Upsert plan (create or update)
router.post(
  "/upsert",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      // Validate request body with Zod
      const validationResult = PlanUpsertSchema.safeParse(req.body);

      if (!validationResult.success) {
        res.status(400).json({
          success: false,
          error: "Invalid request data",
          details: validationResult.error.issues,
        });
        return;
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
          res.status(403).json({
            success: false,
            error: "Not authorized to update this plan",
          });
          return;
        }

        const { milestones, sessions, activities, ...plan } = planData;

        const updatedPlan = await prisma.plan.update({
          where: { id: planData.id },
          data: {
            ...plan,
            deletedAt: planData.deletedAt,
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

        // Invalidate progress cache if activities were modified
        if (planData.activities) {
          await plansService.invalidatePlanProgressCache(updatedPlan.id);
        }

        // Mark user recommendations as outdated
        recommendationsService.computeRecommendedUsers(req.user!.id);

        logger.info(`Updated plan ${planData.id} for user ${req.user!.id}`);
        res.json({ success: true, plan: updatedPlan });
        return;
      } else {
        // Create new plan using existing create-plan logic
        if (!planData.goal) {
          res.status(400).json({
            success: false,
            error: "Goal is required",
          });
          return;
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
              isCoached: planData.isCoached || false,
              backgroundImageUrl: planData.backgroundImageUrl,

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

          // Ensure only one plan is coached at a time
          if (planData.isCoached) {
            await ensureSingleCoachedPlan(tx, req.user!.id, newPlan.id, true);
          }

          return newPlan;
        });

        updatePlanEmbedding(result.id);

        // Mark user recommendations as outdated
        recommendationsService.computeRecommendedUsers(req.user!.id);

        logger.info(`Created plan ${result.id} for user ${req.user!.id}`);
        res.json({ success: true, plan: result });
        return;
      }
    } catch (error) {
      logger.error("Error upserting plan:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to save plan",
      });
      return;
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
      const { existingPlanId } = req.body;

      // Check if it's a PlanInviteLink (external) or PlanGroupMember (direct invite)
      let inviteLink = await prisma.planInviteLink.findUnique({
        where: { id: invitationId },
        include: {
          planGroup: {
            include: {
              plans: {
                include: {
                  activities: true,
                },
              },
            },
          },
        },
      });

      let memberInvite = await prisma.planGroupMember.findUnique({
        where: { id: invitationId },
        include: {
          planGroup: {
            include: {
              plans: {
                include: {
                  activities: true,
                },
              },
            },
          },
        },
      });

      if (!inviteLink && !memberInvite) {
        res.status(404).json({ error: "Invitation not found" });
        return;
      }

      let planGroup:
        | (PlanGroup & { plans: (Plan & { activities: Activity[] })[] })
        | null = null;

      if (inviteLink) {
        // Handle external invite link
        if (!inviteLink.isActive) {
          res.status(400).json({ error: "Invite link is no longer active" });
          return;
        }

        if (inviteLink.maxUses && inviteLink.usedCount >= inviteLink.maxUses) {
          res
            .status(400)
            .json({ error: "Invite link has reached maximum uses" });
          return;
        }

        if (inviteLink.expiresAt && new Date() > inviteLink.expiresAt) {
          res.status(400).json({ error: "Invite link has expired" });
          return;
        }

        planGroup = inviteLink.planGroup;

        // Check if user is already a member
        const existingMember = await prisma.planGroupMember.findUnique({
          where: {
            planGroupId_userId: {
              planGroupId: inviteLink.planGroupId,
              userId: req.user!.id,
            },
          },
        });

        if (existingMember) {
          res
            .status(400)
            .json({ error: "You are already a member of this plan group" });
          return;
        }

        // Increment used count
        await prisma.planInviteLink.update({
          where: { id: invitationId },
          data: { usedCount: { increment: 1 } },
        });
      } else {
        // Handle direct member invitation
        if (memberInvite!.userId !== req.user!.id) {
          res
            .status(403)
            .json({ error: "Not authorized to accept this invitation" });
          return;
        }

        if (memberInvite!.status !== "INVITED") {
          res
            .status(400)
            .json({ error: "Invitation has already been processed" });
          return;
        }

        planGroup = memberInvite!.planGroup;
      }

      // Get the first plan in the group as template
      const templatePlan = planGroup.plans[0];
      if (!templatePlan) {
        res.status(400).json({ error: "No template plan found in group" });
        return;
      }

      // Accept the invitation using a transaction
      const result = await prisma.$transaction(async (tx) => {
        let userPlan: Prisma.PlanGetPayload<{
          include: {
            activities: true;
            sessions: true;
            milestones: true;
            planGroup: {
              include: {
                members: {
                  include: {
                    user: true;
                    plan: true;
                  };
                };
              };
            };
          };
        }>;

        if (existingPlanId) {
          // User chose to link an existing plan to the group
          const existingPlan = await tx.plan.findUnique({
            where: { id: existingPlanId },
            include: {
              activities: true,
              sessions: true,
              milestones: true,
              planGroup: {
                include: {
                  members: {
                    where: {
                      status: "ACTIVE",
                    },
                    include: {
                      user: {
                        select: {
                          id: true,
                          name: true,
                          username: true,
                          picture: true,
                        },
                      },
                      plan: {
                        select: {
                          id: true,
                          goal: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          });

          if (!existingPlan) {
            throw new Error("Existing plan not found");
          }

          if (existingPlan.userId !== req.user!.id) {
            throw new Error("Not authorized to use this plan");
          }

          if (existingPlan.planGroupId) {
            throw new Error("Plan is already part of a group");
          }

          // Update the existing plan to join the group
          userPlan = await tx.plan.update({
            where: { id: existingPlanId },
            data: { planGroupId: planGroup.id },
            include: {
              activities: true,
              sessions: true,
              milestones: true,
              planGroup: {
                include: {
                  members: {
                    where: {
                      status: "ACTIVE",
                    },
                    include: {
                      user: {
                        select: {
                          id: true,
                          name: true,
                          username: true,
                          picture: true,
                        },
                      },
                      plan: {
                        select: {
                          id: true,
                          goal: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          });
        } else {
          // User chose to create a new plan (copy the template)
          // First, create copies of the activities for the new user
          const newActivities = await Promise.all(
            templatePlan.activities.map(async (templateActivity: any) => {
              return await tx.activity.create({
                data: {
                  userId: req.user!.id,
                  title: templateActivity.title,
                  measure: templateActivity.measure,
                  emoji: templateActivity.emoji,
                  colorHex: templateActivity.colorHex,
                },
              });
            })
          );

          // Create a copy of the plan for the new user
          userPlan = await tx.plan.create({
            data: {
              userId: req.user!.id,
              goal: templatePlan.goal,
              emoji: templatePlan.emoji,
              finishingDate: templatePlan.finishingDate,
              notes: templatePlan.notes,
              durationType: templatePlan.durationType,
              outlineType: templatePlan.outlineType,
              timesPerWeek: templatePlan.timesPerWeek,
              isCoached: false, // Default to not coached when joining a plan group
              planGroupId: planGroup.id,
              // Connect to the newly created activities
              activities: {
                connect: newActivities.map((activity) => ({
                  id: activity.id,
                })),
              },
            },
            include: {
              activities: true,
              sessions: true,
              milestones: true,
              planGroup: {
                include: {
                  members: {
                    where: {
                      status: "ACTIVE",
                    },
                    include: {
                      user: {
                        select: {
                          id: true,
                          name: true,
                          username: true,
                          picture: true,
                        },
                      },
                      plan: {
                        select: {
                          id: true,
                          goal: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          });

          // Note: isCoached is false for plan group joins, no need to call ensureSingleCoachedPlan
        }

        // Create or update member record
        if (memberInvite) {
          // Update existing member invitation to ACTIVE
          await tx.planGroupMember.update({
            where: { id: invitationId },
            data: {
              status: "ACTIVE",
              planId: userPlan.id,
              joinedAt: new Date(),
            },
          });
        } else {
          // Create new member record for external link
          await tx.planGroupMember.create({
            data: {
              planGroupId: planGroup.id,
              userId: req.user!.id,
              planId: userPlan.id,
              role: "MEMBER",
              status: "ACTIVE",
              joinedAt: new Date(),
            },
          });
        }

        return userPlan;
      });

      // Mark the related notification as concluded
      if (memberInvite) {
        await prisma.notification.updateMany({
          where: {
            userId: req.user!.id,
            type: "PLAN_INVITATION",
            relatedId: invitationId,
            status: { not: "CONCLUDED" },
          },
          data: {
            status: "CONCLUDED",
            concludedAt: new Date(),
          },
        });
      }

      logger.info(
        `User ${req.user!.id} accepted plan invitation ${invitationId}${existingPlanId ? ` with existing plan ${existingPlanId}` : " with new plan"}`
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

      // Only PlanGroupMember invitations can be rejected (not external links)
      const memberInvite = await prisma.planGroupMember.findUnique({
        where: { id: invitationId },
      });

      if (!memberInvite) {
        res.status(404).json({ error: "Invitation not found" });
        return;
      }

      // Verify the invitation is for the current user
      if (memberInvite.userId !== req.user!.id) {
        res
          .status(403)
          .json({ error: "Not authorized to reject this invitation" });
        return;
      }

      if (memberInvite.status !== "INVITED") {
        res
          .status(400)
          .json({ error: "Invitation has already been processed" });
        return;
      }

      // Update invitation status to rejected
      await prisma.planGroupMember.update({
        where: { id: invitationId },
        data: { status: "REJECTED" },
      });

      // Mark the related notification as concluded
      await prisma.notification.updateMany({
        where: {
          userId: req.user!.id,
          type: "PLAN_INVITATION",
          relatedId: invitationId,
          status: { not: "CONCLUDED" },
        },
        data: {
          status: "CONCLUDED",
          concludedAt: new Date(),
        },
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

// Leave plan group
router.post(
  "/leave-plan-group/:planId",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const { planId } = req.params;

      // Get the plan with group info
      const plan = await prisma.plan.findUnique({
        where: { id: planId },
        include: {
          planGroup: true,
        },
      });

      if (!plan) {
        res.status(404).json({ error: "Plan not found" });
        return;
      }

      if (!plan.planGroupId) {
        res.status(400).json({ error: "Plan is not part of a group" });
        return;
      }

      if (plan.userId !== req.user!.id) {
        res.status(403).json({ error: "Not authorized to leave this plan" });
        return;
      }

      // Update the member status to LEFT
      await prisma.planGroupMember.updateMany({
        where: {
          planGroupId: plan.planGroupId,
          userId: req.user!.id,
          status: "ACTIVE",
        },
        data: {
          status: "LEFT",
          leftAt: new Date(),
        },
      });

      // Remove the planGroupId from the user's plan
      await prisma.plan.update({
        where: { id: planId },
        data: {
          planGroupId: null,
        },
      });

      logger.info(`User ${req.user!.id} left plan group for plan ${planId}`);
      res.json({ message: "Successfully left plan group" });
    } catch (error) {
      logger.error("Error leaving plan group:", error);
      res.status(500).json({ error: "Failed to leave plan group" });
    }
  }
);

// Delete plan (soft delete)
router.delete(
  "/:planId",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const { planId } = req.params;

      // Get the plan with group info
      const plan = await prisma.plan.findUnique({
        where: { id: planId },
        include: {
          planGroup: true,
        },
      });

      if (!plan) {
        res.status(404).json({ error: "Plan not found" });
        return;
      }

      if (plan.userId !== req.user!.id) {
        res.status(403).json({ error: "Not authorized to delete this plan" });
        return;
      }

      // If plan is in a group, automatically leave the group
      if (plan.planGroupId) {
        // Update member status to LEFT
        await prisma.planGroupMember.updateMany({
          where: {
            planGroupId: plan.planGroupId,
            userId: req.user!.id,
            status: "ACTIVE",
          },
          data: {
            status: "LEFT",
            leftAt: new Date(),
          },
        });

        logger.info(
          `User ${req.user!.id} automatically left plan group when deleting plan ${planId}`
        );
      }

      // Soft delete the plan
      const deletedPlan = await prisma.plan.update({
        where: { id: planId },
        data: {
          deletedAt: new Date(),
          planGroupId: null, // Clear group reference
        },
      });

      logger.info(`User ${req.user!.id} deleted plan ${planId}`);
      res.json({ success: true, plan: deletedPlan });
    } catch (error) {
      logger.error("Error deleting plan:", error);
      res.status(500).json({ error: "Failed to delete plan" });
    }
  }
);

export const plansRouter: Router = router;
export default plansRouter;
