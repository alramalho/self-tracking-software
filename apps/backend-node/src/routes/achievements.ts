import { AchievementPost, AchievementType } from "@tsw/prisma";
import { Response, Router } from "express";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { notificationService } from "../services/notificationService";
import { s3Service } from "../services/s3Service";
import { logger } from "../utils/logger";
import { prisma } from "../utils/prisma";
import { AuthenticatedRequest, requireAuth } from "@/middleware/auth";

const router: Router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Create achievement post
router.post(
  "/create",
  requireAuth,
  upload.array("photos", 10), // Support up to 10 photos
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      logger.info(
        `Creating achievement post for user ${req.user!.username} (${req.user!.id})`
      );
      const { planId, achievementType, streakNumber, levelName, message } = req.body;
      const photos = req.files as Express.Multer.File[] | undefined;

      // Validate achievement type
      if (!["STREAK", "HABIT", "LIFESTYLE", "LEVEL_UP"].includes(achievementType)) {
        return res.status(400).json({ error: "Invalid achievement type" });
      }

      // For non-level-up achievements, planId is required
      let plan: { id: string; emoji: string | null; goal: string } | null = null;
      if (achievementType !== "LEVEL_UP") {
        if (!planId) {
          return res.status(400).json({ error: "Plan ID is required for this achievement type" });
        }
        plan = await prisma.plan.findFirst({
          where: {
            id: planId,
            userId: req.user!.id,
            deletedAt: null,
          },
        });
        if (!plan) {
          return res.status(404).json({ error: "Plan not found" });
        }
      } else {
        // For level-up, levelName is required
        if (!levelName) {
          return res.status(400).json({ error: "Level name is required for level-up achievements" });
        }
      }

      // Create achievement post
      const achievementPost = await prisma.achievementPost.create({
        data: {
          userId: req.user!.id,
          planId: planId || null,
          achievementType: achievementType as AchievementType,
          streakNumber: streakNumber ? parseInt(streakNumber) : null,
          levelName: levelName || null,
          message: message || null,
        },
      });

      logger.info(`Achievement post created: ${achievementPost.id}`);

      // Handle photo uploads if provided
      if (photos && photos.length > 0) {
        try {
          const imageCreationPromises = photos.map(async (photo, index) => {
            const photoId = uuidv4();
            const fileExtension = photo.originalname
              ? photo.originalname.split(".").pop()
              : "jpg";
            const s3Path = `/users/${req.user!.id}/achievement_posts/${achievementPost.id}/photos/${photoId}.${fileExtension}`;

            // Upload to S3
            await s3Service.upload(photo.buffer, s3Path, photo.mimetype);

            // Generate presigned URL with 7 days expiration
            const expirationSeconds = 7 * 24 * 60 * 60; // 7 days
            const presignedUrl = await s3Service.generatePresignedUrl(
              s3Path,
              expirationSeconds
            );
            const expiresAt = new Date(Date.now() + expirationSeconds * 1000);

            // Create achievement image record
            return prisma.achievementImage.create({
              data: {
                achievementPostId: achievementPost.id,
                s3Path: s3Path,
                url: presignedUrl,
                expiresAt: expiresAt,
                sortOrder: index,
              },
            });
          });

          await Promise.all(imageCreationPromises);
          logger.info(
            `${photos.length} photo(s) uploaded successfully for achievement post ${achievementPost.id}`
          );
        } catch (error) {
          logger.error("Error uploading photos to S3:", error);
          // Continue without photos - don't fail the entire achievement post creation
        }
      }

      // Create notifications for connected users about the achievement
      const userWithConnections = await prisma.user.findUnique({
        where: { id: req.user!.id },
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

      if (userWithConnections) {
        const connectedUsers = [
          ...userWithConnections.connectionsFrom.map((conn) => conn.to),
          ...userWithConnections.connectionsTo.map((conn) => conn.from),
        ];

        const achievementTypeText =
          achievementType === "STREAK"
            ? `${streakNumber} week streak`
            : achievementType === "HABIT"
              ? "habit milestone"
              : achievementType === "LIFESTYLE"
                ? "lifestyle achievement"
                : `level-up to ${levelName}`;

        for (const connectedUser of connectedUsers) {
          const notificationMessage = achievementType === "LEVEL_UP"
            ? `${req.user!.username} reached ${levelName} level! 🎖️`
            : `${req.user!.username} shared a ${achievementTypeText} for ${plan!.emoji} ${plan!.goal}! 🎉`;
          await notificationService.createAndProcessNotification({
            userId: connectedUser.id,
            message: notificationMessage,
            type: "INFO",
            relatedId: achievementPost.id,
            relatedData: {
              achievementPostId: achievementPost.id,
              userPicture: req.user!.picture,
              userName: req.user!.name,
              userUsername: req.user!.username,
            },
          });
        }
      }

      // Fetch the complete achievement post with images
      const completeAchievementPost = await prisma.achievementPost.findUnique({
        where: { id: achievementPost.id },
        include: {
          images: {
            orderBy: { sortOrder: "asc" },
          },
          plan: true,
          user: {
            select: {
              id: true,
              username: true,
              name: true,
              picture: true,
            },
          },
        },
      });

      return res.status(201).json({
        success: true,
        achievementPost: completeAchievementPost,
      });
    } catch (error) {
      logger.error("Error creating achievement post:", error);
      return res.status(500).json({
        error: "Failed to create achievement post",
      });
    }
  }
);

// Get achievement posts for a user
router.get(
  "/user/:userId",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const { userId } = req.params;

      const achievementPosts = await prisma.achievementPost.findMany({
        where: {
          userId: userId,
          deletedAt: null,
        },
        include: {
          images: {
            orderBy: { sortOrder: "asc" },
          },
          plan: true,
          user: {
            select: {
              id: true,
              username: true,
              name: true,
              picture: true,
            },
          },
          reactions: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  name: true,
                  picture: true,
                },
              },
            },
          },
          comments: {
            where: {
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
            },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return res.status(200).json({
        success: true,
        achievementPosts,
      });
    } catch (error) {
      logger.error("Error fetching achievement posts:", error);
      return res.status(500).json({
        error: "Failed to fetch achievement posts",
      });
    }
  }
);

// Delete achievement post
router.delete(
  "/:id",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const { id } = req.params;

      const achievementPost = await prisma.achievementPost.findUnique({
        where: { id },
      });

      if (!achievementPost) {
        return res.status(404).json({ error: "Achievement post not found" });
      }

      if (achievementPost.userId !== req.user!.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      await prisma.achievementPost.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      res.json({ message: "Achievement post deleted successfully" });
    } catch (error) {
      logger.error("Error deleting achievement post:", error);
      res.status(500).json({ error: "Failed to delete achievement post" });
    }
  }
);

// Modify reactions for achievement post
router.post(
  "/:achievementPostId/modify-reactions",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const { achievementPostId } = req.params;
      const { reactions } = req.body;

      if (!Array.isArray(reactions) || !reactions.length) {
        return res.status(400).json({ error: "No reactions provided" });
      }

      for (const { emoji, operation } of reactions) {
        if (!emoji || !operation) {
          continue;
        }

        if (operation === "add") {
          await prisma.reaction.upsert({
            where: {
              achievementPostId_userId_emoji: {
                achievementPostId,
                userId: req.user!.id,
                emoji,
              },
            },
            update: {},
            create: {
              achievementPostId,
              userId: req.user!.id,
              emoji,
            },
          });
        } else if (operation === "remove") {
          await prisma.reaction.deleteMany({
            where: {
              achievementPostId,
              userId: req.user!.id,
              emoji,
            },
          });
        }
      }

      const allReactions = await prisma.reaction.findMany({
        where: { achievementPostId },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              picture: true,
              planType: true,
            },
          },
        },
      });

      res.json({
        message: "Reactions modified successfully",
        reactions: allReactions,
      });
    } catch (error) {
      logger.error("Error modifying reactions:", error);
      res.status(500).json({ error: "Failed to modify reactions" });
    }
  }
);

// Add comment to achievement post
router.post(
  "/:achievementPostId/comments",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const { achievementPostId } = req.params;
      const { text } = req.body;

      const comment = await prisma.comment.create({
        data: {
          achievementPostId,
          userId: req.user!.id,
          text,
        },
      });

      // Get achievement post to notify owner
      const achievementPost = await prisma.achievementPost.findUnique({
        where: { id: achievementPostId },
      });

      const notifiedUserIds = new Set<string>();

      // Notify achievement post owner (if not the commenter)
      if (achievementPost && achievementPost.userId !== req.user!.id) {
        const truncatedText =
          text.length > 30 ? `${text.slice(0, 30)}...` : text;
        await notificationService.createAndProcessNotification({
          userId: achievementPost.userId,
          message: `@${req.user!.username} commented on your achievement: "${truncatedText}"`,
          type: "INFO",
          relatedId: achievementPostId,
          relatedData: {
            achievementPostId: achievementPostId,
            commenterId: req.user!.id,
            commenterPicture: req.user!.picture,
            commenterName: req.user!.name,
            commenterUsername: req.user!.username,
          },
        });
        notifiedUserIds.add(achievementPost.userId);
      }

      // Extract @mentions from comment text
      const mentionRegex = /@([a-zA-Z0-9_]+)/g;
      const mentions = [...text.matchAll(mentionRegex)];

      if (mentions.length > 0) {
        const uniqueUsernames = [
          ...new Set(mentions.map((m) => m[1].toLowerCase())),
        ];

        const mentionedUsers = await prisma.user.findMany({
          where: {
            username: { in: uniqueUsernames },
            deletedAt: null,
          },
          select: {
            id: true,
            username: true,
          },
        });

        for (const mentionedUser of mentionedUsers) {
          if (
            mentionedUser.id === req.user!.id ||
            notifiedUserIds.has(mentionedUser.id)
          ) {
            continue;
          }

          const truncatedText =
            text.length > 30 ? `${text.slice(0, 30)}...` : text;

          await notificationService.createAndProcessNotification({
            userId: mentionedUser.id,
            message: `@${req.user!.username} mentioned you in a comment: "${truncatedText}"`,
            type: "INFO",
            relatedId: achievementPostId,
            relatedData: {
              achievementPostId: achievementPostId,
              commenterId: req.user!.id,
              commenterPicture: req.user!.picture,
              commenterName: req.user!.name,
              commenterUsername: req.user!.username,
            },
          });

          notifiedUserIds.add(mentionedUser.id);
        }
      }

      // Get all comments for this achievement post
      const allComments = await prisma.comment.findMany({
        where: {
          achievementPostId,
        },
        include: {
          user: { select: { username: true, picture: true, name: true } },
        },
        orderBy: { createdAt: "asc" },
      });

      res.json({
        message: "Comment added successfully",
        comments: allComments,
      });
    } catch (error) {
      logger.error("Error adding comment:", error);
      res.status(500).json({ error: "Failed to add comment" });
    }
  }
);

// Remove comment from achievement post
router.delete(
  "/:achievementPostId/comments/:commentId",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const { achievementPostId, commentId } = req.params;

      // Verify ownership
      const comment = await prisma.comment.findFirst({
        where: {
          id: commentId,
          achievementPostId,
          userId: req.user!.id,
        },
      });

      if (!comment) {
        return res.status(404).json({ error: "Comment not found" });
      }

      await prisma.comment.delete({
        where: { id: commentId },
      });

      // Get remaining comments
      const remainingComments = await prisma.comment.findMany({
        where: {
          achievementPostId,
        },
        include: {
          user: { select: { username: true, picture: true, name: true } },
        },
        orderBy: { createdAt: "asc" },
      });

      res.json({
        message: "Comment removed successfully",
        comments: remainingComments,
      });
    } catch (error) {
      logger.error("Error removing comment:", error);
      res.status(500).json({ error: "Failed to remove comment" });
    }
  }
);

// Mark level as celebrated
router.post(
  "/mark-level-celebrated",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const { levelThreshold } = req.body;

      if (typeof levelThreshold !== "number" || levelThreshold < 0) {
        return res.status(400).json({ error: "Invalid level threshold" });
      }

      await prisma.user.update({
        where: { id: req.user!.id },
        data: { celebratedLevelThreshold: levelThreshold },
      });

      logger.info(
        `User ${req.user!.username} marked level threshold ${levelThreshold} as celebrated`
      );

      res.json({
        success: true,
        celebratedLevelThreshold: levelThreshold,
      });
    } catch (error) {
      logger.error("Error marking level as celebrated:", error);
      res.status(500).json({ error: "Failed to mark level as celebrated" });
    }
  }
);

export { router as achievementsRouter };
