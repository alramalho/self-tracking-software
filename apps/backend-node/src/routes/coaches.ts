import { AuthenticatedRequest, requireAuth } from "@/middleware/auth";
import { Request, Response, Router } from "express";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod/v4";
import { logger } from "../utils/logger";
import { prisma } from "../utils/prisma";
import { s3Service } from "../services/s3Service";
import { notificationService } from "../services/notificationService";
import { format } from "date-fns";
import { plansService } from "../services/plansService";

const router: Router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit for videos
});

// Schema for coach profile creation
const CreateCoachProfileSchema = z.object({
  title: z.string().min(1), // e.g., "Fitness Coach", "Life Coach"
  bio: z.string().min(1), // Longer bio about the coach
  focusDescription: z.string().min(1), // 1-2 sentences about specialization
  idealPlans: z.array(
    z.object({
      emoji: z.string(),
      title: z.string(),
    })
  ),
});

// Create or update coach profile (become a human coach)
router.post(
  "/create-profile",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const body = CreateCoachProfileSchema.parse(req.body);
      const userId = req.user!.id;

      // Check if user already has a HUMAN coach profile
      let coach = await prisma.coach.findFirst({
        where: {
          ownerId: userId,
          type: "HUMAN",
        },
      });

      const details = {
        title: body.title,
        bio: body.bio,
        focusDescription: body.focusDescription,
        idealPlans: body.idealPlans,
      };

      if (coach) {
        // Update existing coach profile
        coach = await prisma.coach.update({
          where: { id: coach.id },
          data: { details },
        });
        logger.info(`Updated coach profile for user '${req.user!.username}'`);
      } else {
        // Create new coach profile
        coach = await prisma.coach.create({
          data: {
            ownerId: userId,
            type: "HUMAN",
            details,
          },
        });
        logger.info(`Created coach profile for user '${req.user!.username}'`);
      }

      res.json(coach);
    } catch (error) {
      logger.error("Error creating coach profile:", error);
      res.status(500).json({ error: "Failed to create coach profile" });
    }
  }
);

// Get current user's coach profile
router.get(
  "/my-profile",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const coach = await prisma.coach.findFirst({
        where: {
          ownerId: req.user!.id,
          type: "HUMAN",
        },
      });

      if (!coach) {
        res.status(404).json({ error: "Coach profile not found" });
        return;
      }

      res.json(coach);
    } catch (error) {
      logger.error("Error fetching coach profile:", error);
      res.status(500).json({ error: "Failed to fetch coach profile" });
    }
  }
);

// List all human coaches (public endpoint for coach selection)
router.get("/", async (req: Request, res: Response) => {
  try {
    const coaches = await prisma.coach.findMany({
      where: {
        type: "HUMAN",
      },
      include: {
        owner: {
          select: {
            id: true,
            username: true,
            name: true,
            picture: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(coaches);
  } catch (error) {
    logger.error("Error fetching coaches:", error);
    res.status(500).json({ error: "Failed to fetch coaches" });
  }
});

// Get coach's clients (plans they are coaching)
router.get(
  "/my-clients",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Find the user's coach profile
      const coach = await prisma.coach.findFirst({
        where: {
          ownerId: req.user!.id,
          type: "HUMAN",
        },
      });

      if (!coach) {
        res.status(404).json({ error: "Coach profile not found" });
        return;
      }

      // Get all plans this coach is managing
      const plans = await prisma.plan.findMany({
        where: {
          coachId: coach.id,
          deletedAt: null,
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              name: true,
              picture: true,
            },
          },
          activities: true,
          sessions: {
            orderBy: { date: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      res.json(plans);
    } catch (error) {
      logger.error("Error fetching coach clients:", error);
      res.status(500).json({ error: "Failed to fetch clients" });
    }
  }
);

// Get complete client plan data for coach overview
router.get(
  "/clients/:planId",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { planId } = req.params;

      // Find the user's coach profile
      const coach = await prisma.coach.findFirst({
        where: {
          ownerId: req.user!.id,
          type: "HUMAN",
        },
      });

      if (!coach) {
        res.status(404).json({ error: "Coach profile not found" });
        return;
      }

      // Get the plan with full relations, verifying this coach manages it
      const plan = await prisma.plan.findFirst({
        where: {
          id: planId,
          coachId: coach.id,
          deletedAt: null,
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              name: true,
              picture: true,
            },
          },
          activities: {
            where: {
              deletedAt: null,
            },
          },
          sessions: {
            orderBy: { date: "asc" },
          },
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
      });

      if (!plan) {
        res.status(404).json({ error: "Client plan not found or you are not the coach" });
        return;
      }

      // Get plan progress
      const [planProgress] = await plansService.getBatchPlanProgress(
        [planId],
        plan.userId,
        false // Use cache
      );

      // Get activity entries for this client's plan activities
      const activityIds = plan.activities.map((a) => a.id);
      const activityEntries = await prisma.activityEntry.findMany({
        where: {
          userId: plan.userId,
          activityId: { in: activityIds },
          deletedAt: null,
        },
        orderBy: { datetime: "desc" },
      });

      res.json({
        ...plan,
        progress: planProgress,
        activityEntries,
      });
    } catch (error) {
      logger.error("Error fetching client plan:", error);
      res.status(500).json({ error: "Failed to fetch client plan" });
    }
  }
);

// Upload introduction video for coach profile
router.post(
  "/upload-video",
  requireAuth,
  upload.single("video"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: "No video file provided" });
        return;
      }

      // Verify user has a coach profile
      const coach = await prisma.coach.findFirst({
        where: {
          ownerId: req.user!.id,
          type: "HUMAN",
        },
      });

      if (!coach) {
        res.status(404).json({ error: "Coach profile not found. Create a profile first." });
        return;
      }

      // Upload to S3
      const fileExtension = file.originalname.split(".").pop() || "mp4";
      const key = `coach-videos/${coach.id}/${uuidv4()}.${fileExtension}`;

      await s3Service.upload(file.buffer, key, file.mimetype);
      const videoUrl = s3Service.getPublicUrl(key);

      // Update coach profile with video URL
      const currentDetails = (coach.details as Record<string, unknown>) || {};
      const updatedCoach = await prisma.coach.update({
        where: { id: coach.id },
        data: {
          details: {
            ...currentDetails,
            introVideoUrl: videoUrl,
          },
        },
      });

      logger.info(`Uploaded intro video for coach '${req.user!.username}'`);
      res.json({ videoUrl, coach: updatedCoach });
    } catch (error) {
      logger.error("Error uploading coach video:", error);
      res.status(500).json({ error: "Failed to upload video" });
    }
  }
);

// Schema for coaching request
const CoachingRequestSchema = z.object({
  coachId: z.string().min(1),
  planId: z.string().min(1),
  message: z.string().optional(),
});

// Send a coaching request to a human coach
router.post(
  "/request",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const body = CoachingRequestSchema.parse(req.body);
      const user = req.user!;

      // Find the coach
      const coach = await prisma.coach.findUnique({
        where: { id: body.coachId },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              username: true,
            },
          },
        },
      });

      if (!coach || coach.type !== "HUMAN") {
        res.status(404).json({ error: "Coach not found" });
        return;
      }

      // Find the user's plan
      const plan = await prisma.plan.findFirst({
        where: {
          id: body.planId,
          userId: user.id,
          deletedAt: null,
        },
        include: {
          activities: true,
        },
      });

      if (!plan) {
        res.status(404).json({ error: "Plan not found" });
        return;
      }

      // Check if plan is already being coached
      if (plan.coachId) {
        res.status(400).json({ error: "This plan already has a coach" });
        return;
      }

      // Create or find existing direct chat with the coach
      let chat = await prisma.chat.findFirst({
        where: {
          type: "DIRECT",
          AND: [
            { participants: { some: { userId: user.id } } },
            { participants: { some: { userId: coach.ownerId } } },
          ],
        },
      });

      if (!chat) {
        chat = await prisma.chat.create({
          data: {
            type: "DIRECT",
            participants: {
              create: [{ userId: user.id }, { userId: coach.ownerId }],
            },
          },
        });
        logger.info(
          `Created direct chat ${chat.id} for coaching request from ${user.username} to ${coach.owner.username}`
        );
      }

      // Format the coaching request message
      const activitiesStr = plan.activities
        .map((a) => `${a.emoji} ${a.title}`)
        .join(", ");

      const dedent = (str: string) =>
        str.replace(/^[ \t]*([\S].*?)[ \t]*$/gm, '$1').trim();

      const messageContent = dedent(`
        **Coaching Request**

        Hi! I'd like to request coaching for my plan.

        **Plan:** ${plan.emoji} ${plan.goal}
        **Activities:** ${activitiesStr}
        **Frequency:** ${plan.timesPerWeek || "Not set"} times per week

        ${body.message ? `**Message:**\n${body.message}` : ""}

        Looking forward to working with you!
      `);

      // Send the message
      await prisma.message.create({
        data: {
          chatId: chat.id,
          role: "USER",
          content: messageContent,
        },
      });

      // Update chat's updatedAt timestamp
      await prisma.chat.update({
        where: { id: chat.id },
        data: { updatedAt: new Date() },
      });

      logger.info(
        `Coaching request sent from ${user.username} to ${coach.owner.username} for plan ${plan.goal}`
      );

      res.json({
        success: true,
        chatId: chat.id,
        message: "Coaching request sent successfully",
      });
    } catch (error) {
      logger.error("Error sending coaching request:", error);
      res.status(500).json({ error: "Failed to send coaching request" });
    }
  }
);

// Upload images for a session (coach only)
router.post(
  "/sessions/:sessionId/upload-images",
  requireAuth,
  upload.array("images", 10), // Max 10 images
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { sessionId } = req.params;
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        res.status(400).json({ error: "No image files provided" });
        return;
      }

      // Find the user's coach profile
      const coach = await prisma.coach.findFirst({
        where: {
          ownerId: req.user!.id,
          type: "HUMAN",
        },
      });

      if (!coach) {
        res.status(404).json({ error: "Coach profile not found" });
        return;
      }

      // Get the session with its plan
      const session = await prisma.planSession.findUnique({
        where: { id: sessionId },
        include: {
          plan: {
            select: {
              id: true,
              coachId: true,
            },
          },
        },
      });

      if (!session) {
        res.status(404).json({ error: "Session not found" });
        return;
      }

      // Verify this coach manages the plan
      if (session.plan.coachId !== coach.id) {
        res.status(403).json({ error: "You are not the coach for this plan" });
        return;
      }

      // Upload each image to S3
      const uploadedUrls: string[] = [];
      for (const file of files) {
        const imageId = uuidv4();
        const fileExtension = file.originalname?.split(".").pop() || "jpg";
        const s3Path = `sessions/${sessionId}/images/${imageId}.${fileExtension}`;

        await s3Service.upload(file.buffer, s3Path, file.mimetype);
        const imageUrl = s3Service.getPublicUrl(s3Path);
        uploadedUrls.push(imageUrl);
      }

      // Append new URLs to existing imageUrls
      const existingUrls = session.imageUrls || [];
      const updatedUrls = [...existingUrls, ...uploadedUrls];

      // Update the session with new image URLs
      const updatedSession = await prisma.planSession.update({
        where: { id: sessionId },
        data: {
          imageUrls: updatedUrls,
        },
      });

      logger.info(
        `Coach ${req.user!.username} uploaded ${files.length} images to session ${sessionId}`
      );

      res.json({
        imageUrls: updatedUrls,
        newUrls: uploadedUrls,
        session: updatedSession,
      });
    } catch (error) {
      logger.error("Error uploading session images:", error);
      res.status(500).json({ error: "Failed to upload images" });
    }
  }
);

// Delete an image from a session (coach only)
router.delete(
  "/sessions/:sessionId/images",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { imageUrl } = req.body;

      if (!imageUrl) {
        res.status(400).json({ error: "Image URL is required" });
        return;
      }

      // Find the user's coach profile
      const coach = await prisma.coach.findFirst({
        where: {
          ownerId: req.user!.id,
          type: "HUMAN",
        },
      });

      if (!coach) {
        res.status(404).json({ error: "Coach profile not found" });
        return;
      }

      // Get the session with its plan
      const session = await prisma.planSession.findUnique({
        where: { id: sessionId },
        include: {
          plan: {
            select: {
              id: true,
              coachId: true,
            },
          },
        },
      });

      if (!session) {
        res.status(404).json({ error: "Session not found" });
        return;
      }

      // Verify this coach manages the plan
      if (session.plan.coachId !== coach.id) {
        res.status(403).json({ error: "You are not the coach for this plan" });
        return;
      }

      // Remove the URL from the array
      const updatedUrls = (session.imageUrls || []).filter(
        (url) => url !== imageUrl
      );

      // Update the session
      const updatedSession = await prisma.planSession.update({
        where: { id: sessionId },
        data: {
          imageUrls: updatedUrls,
        },
      });

      logger.info(
        `Coach ${req.user!.username} deleted an image from session ${sessionId}`
      );

      res.json({
        imageUrls: updatedUrls,
        session: updatedSession,
      });
    } catch (error) {
      logger.error("Error deleting session image:", error);
      res.status(500).json({ error: "Failed to delete image" });
    }
  }
);

// Schema for session update
const UpdateSessionSchema = z.object({
  activityId: z.string().optional(),
  date: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: "Invalid datetime string",
    })
    .optional(),
  quantity: z.number().positive().optional(),
  descriptiveGuide: z.string().optional(),
  imageUrls: z.array(z.string()).optional(),
});

// Update a session for a client (coach only)
router.patch(
  "/sessions/:sessionId",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { sessionId } = req.params;
      const body = UpdateSessionSchema.parse(req.body);

      // Find the user's coach profile
      const coach = await prisma.coach.findFirst({
        where: {
          ownerId: req.user!.id,
          type: "HUMAN",
        },
        include: {
          owner: {
            select: {
              name: true,
              username: true,
              picture: true,
            },
          },
        },
      });

      if (!coach) {
        res.status(404).json({ error: "Coach profile not found" });
        return;
      }

      // Get the session with its plan
      const session = await prisma.planSession.findUnique({
        where: { id: sessionId },
        include: {
          plan: {
            select: {
              id: true,
              coachId: true,
              userId: true,
              goal: true,
              emoji: true,
            },
          },
          activity: {
            select: {
              id: true,
              title: true,
              emoji: true,
              measure: true,
            },
          },
        },
      });

      if (!session) {
        res.status(404).json({ error: "Session not found" });
        return;
      }

      // Verify this coach manages the plan
      if (session.plan.coachId !== coach.id) {
        res.status(403).json({ error: "You are not the coach for this plan" });
        return;
      }

      // Prepare update data
      const updateData: {
        activityId?: string;
        date?: Date;
        quantity?: number;
        descriptiveGuide?: string;
        imageUrls?: string[];
      } = {};

      if (body.activityId !== undefined) {
        updateData.activityId = body.activityId;
      }
      if (body.date !== undefined) {
        updateData.date = new Date(body.date);
      }
      if (body.quantity !== undefined) {
        updateData.quantity = body.quantity;
      }
      if (body.descriptiveGuide !== undefined) {
        updateData.descriptiveGuide = body.descriptiveGuide;
      }
      if (body.imageUrls !== undefined) {
        updateData.imageUrls = body.imageUrls;
      }

      // Store original values for the message
      const originalActivity = session.activity;
      const originalDate = format(session.date, "MMM d, yyyy");
      const originalQuantity = session.quantity;
      const originalGuide = session.descriptiveGuide;

      // Update the session
      const updatedSession = await prisma.planSession.update({
        where: { id: sessionId },
        data: updateData,
        include: {
          activity: {
            select: {
              id: true,
              title: true,
              emoji: true,
              measure: true,
            },
          },
        },
      });

      // Build the change message
      const changes: string[] = [];

      if (body.activityId && body.activityId !== session.activityId) {
        changes.push(
          `**Activity:** ${originalActivity.emoji} ${originalActivity.title} → ${updatedSession.activity.emoji} ${updatedSession.activity.title}`
        );
      }
      if (body.date) {
        const newDate = format(updatedSession.date, "MMM d, yyyy");
        if (newDate !== originalDate) {
          changes.push(`**Date:** ${originalDate} → ${newDate}`);
        }
      }
      if (body.quantity !== undefined && body.quantity !== originalQuantity) {
        const measure = updatedSession.activity.measure || "units";
        changes.push(
          `**Quantity:** ${originalQuantity} ${measure} → ${body.quantity} ${measure}`
        );
      }
      if (
        body.descriptiveGuide !== undefined &&
        body.descriptiveGuide !== originalGuide
      ) {
        if (originalGuide && body.descriptiveGuide) {
          changes.push(`**Guide:** Updated session instructions`);
        } else if (body.descriptiveGuide) {
          changes.push(`**Guide:** Added session instructions`);
        } else {
          changes.push(`**Guide:** Removed session instructions`);
        }
      }

      // Only send message if there were actual changes
      if (changes.length > 0) {
        // Find or create direct chat with the trainee
        let chat = await prisma.chat.findFirst({
          where: {
            type: "DIRECT",
            AND: [
              { participants: { some: { userId: req.user!.id } } },
              { participants: { some: { userId: session.plan.userId } } },
            ],
          },
        });

        if (!chat) {
          chat = await prisma.chat.create({
            data: {
              type: "DIRECT",
              participants: {
                create: [
                  { userId: req.user!.id },
                  { userId: session.plan.userId },
                ],
              },
            },
          });
        }

        const sessionDate = format(updatedSession.date, "EEEE, MMM d");
        const messageContent = `📅 **Session Updated**

I've made some changes to your ${updatedSession.activity.emoji} ${updatedSession.activity.title} session on **${sessionDate}**:

${changes.join("\n")}

Let me know if you have any questions!`;

        // Send the message
        await prisma.message.create({
          data: {
            chatId: chat.id,
            role: "USER",
            content: messageContent,
          },
        });

        // Update chat timestamp
        await prisma.chat.update({
          where: { id: chat.id },
          data: { updatedAt: new Date() },
        });

        // Send push notification for the message
        await notificationService.createAndProcessNotification({
          userId: session.plan.userId,
          title: "Message from your coach",
          message: `Session updated: ${updatedSession.activity.emoji} ${updatedSession.activity.title}`,
          type: "INFO",
          relatedId: chat.id,
          relatedData: {
            chatId: chat.id,
            coachName: coach.owner.name || coach.owner.username,
          },
        });
      }

      logger.info(
        `Coach ${req.user!.username} updated session ${sessionId} for plan ${session.plan.id}`
      );

      res.json(updatedSession);
    } catch (error) {
      logger.error("Error updating session:", error);
      res.status(500).json({ error: "Failed to update session" });
    }
  }
);

export const coachesRouter: Router = router;
export default router;
