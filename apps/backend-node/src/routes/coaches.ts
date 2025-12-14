import { AuthenticatedRequest, requireAuth } from "@/middleware/auth";
import { Response, Router } from "express";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod/v4";
import { logger } from "../utils/logger";
import { prisma } from "../utils/prisma";
import { s3Service } from "../services/s3Service";

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

// List all human coaches (for coach selection in onboarding)
router.get("/", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
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

      const messageContent = `**Coaching Request**

Hi! I'd like to request coaching for my plan.

**Plan:** ${plan.emoji} ${plan.goal}
**Activities:** ${activitiesStr}
**Frequency:** ${plan.timesPerWeek || "Not set"} times per week

${body.message ? `**Message:**\n${body.message}` : ""}

Looking forward to working with you!`;

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

export const coachesRouter: Router = router;
export default router;
