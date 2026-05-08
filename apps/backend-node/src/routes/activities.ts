import { AuthenticatedRequest, requireAuth } from "@/middleware/auth";
import { plansService } from "@/services/plansService";
import { ActivityEntry } from "@tsw/prisma";
import { Response, Router } from "express";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { notificationService } from "../services/notificationService";
import { s3Service } from "../services/s3Service";
import { buildActivityEntryImageUpdate } from "../utils/activityEntryImages";
import { logger } from "../utils/logger";
import { prisma } from "../utils/prisma";
import { scoreSharedActivityCandidate } from "../utils/sharedActivities";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

const sharedActivityInclude = {
  include: {
    sharedActivity: {
      include: {
        entries: {
          include: {
            user: {
              select: { id: true, username: true, name: true, picture: true },
            },
            activityEntry: {
              select: { id: true, userId: true, deletedAt: true },
            },
          },
        },
      },
    },
  },
} as const;

const activityEntrySocialInclude = {
  comments: {
    where: { deletedAt: null },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          picture: true,
        },
      },
    },
    orderBy: { createdAt: "asc" as const },
  },
  reactions: {
    include: {
      user: {
        select: {
          id: true,
          username: true,
          picture: true,
        },
      },
    },
  },
  sharedActivityEntry: sharedActivityInclude,
};

async function getAcceptedConnectionIds(userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      connectionsFrom: { where: { status: "ACCEPTED" }, select: { toId: true } },
      connectionsTo: { where: { status: "ACCEPTED" }, select: { fromId: true } },
    },
  });

  if (!user) return [];
  return [
    ...user.connectionsFrom.map((connection) => connection.toId),
    ...user.connectionsTo.map((connection) => connection.fromId),
  ];
}

async function getVisibleActivityIdsForUsers(userIds: string[]): Promise<Set<string>> {
  if (!userIds.length) return new Set();

  const [activities, publicPlans] = await Promise.all([
    prisma.activity.findMany({
      where: { userId: { in: userIds }, deletedAt: null },
      select: { id: true },
    }),
    prisma.plan.findMany({
      where: {
        userId: { in: userIds },
        deletedAt: null,
        visibility: "PUBLIC",
      },
      select: { activities: { select: { id: true } } },
    }),
  ]);

  const publicActivityIds = new Set<string>();
  publicPlans.forEach((plan) => {
    plan.activities.forEach((activity) => publicActivityIds.add(activity.id));
  });

  const plannedActivityIds = new Set<string>();
  const allPlans = await prisma.plan.findMany({
    where: { userId: { in: userIds }, deletedAt: null },
    select: { activities: { select: { id: true } } },
  });
  allPlans.forEach((plan) => {
    plan.activities.forEach((activity) => plannedActivityIds.add(activity.id));
  });

  return new Set(
    activities
      .filter((activity) => publicActivityIds.has(activity.id) || !plannedActivityIds.has(activity.id))
      .map((activity) => activity.id)
  );
}

async function findSharedActivityCandidates(activityEntryId: string, userId: string) {
  const entry = await prisma.activityEntry.findFirst({
    where: { id: activityEntryId, userId, deletedAt: null, activityId: { not: null } },
    include: { activity: true, sharedActivityEntry: true },
  });

  if (!entry?.activity || entry.sharedActivityEntry) return [];

  const connectionIds = await getAcceptedConnectionIds(userId);
  if (!connectionIds.length) return [];

  const visibleActivityIds = await getVisibleActivityIdsForUsers(connectionIds);
  if (!visibleActivityIds.size) return [];

  const start = new Date(entry.datetime.getTime() - 3 * 60 * 60 * 1000);
  const end = new Date(entry.datetime.getTime() + 3 * 60 * 60 * 1000);

  const candidates = await prisma.activityEntry.findMany({
    where: {
      userId: { in: connectionIds },
      deletedAt: null,
      activityId: { in: Array.from(visibleActivityIds) },
      datetime: { gte: start, lte: end },
      sharedActivityEntry: null,
    },
    include: {
      activity: true,
      user: { select: { id: true, username: true, name: true, picture: true } },
    },
    take: 20,
  });

  return candidates
    .map((candidate) => ({
      candidate,
      score: candidate.activity
        ? scoreSharedActivityCandidate({
            sourceTitle: entry.activity!.title,
            sourceMeasure: entry.activity!.measure,
            sourceEmoji: entry.activity!.emoji,
            sourceDatetime: entry.datetime,
            candidateTitle: candidate.activity.title,
            candidateMeasure: candidate.activity.measure,
            candidateEmoji: candidate.activity.emoji,
            candidateDatetime: candidate.datetime,
          })
        : 0,
    }))
    .filter(({ score }) => score >= 50)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ candidate, score }) => ({
      activityEntryId: candidate.id,
      user: candidate.user,
      activity: candidate.activity,
      datetime: candidate.datetime,
      quantity: candidate.quantity,
      score,
    }));
}

async function canLinkActivityEntries(userId: string, ownEntryId: string, candidateEntryId: string) {
  const ownEntry = await prisma.activityEntry.findFirst({
    where: { id: ownEntryId, userId, deletedAt: null, activityId: { not: null } },
    include: { activity: true },
  });
  if (!ownEntry?.activity) return false;

  const connectionIds = await getAcceptedConnectionIds(userId);
  const candidateEntry = await prisma.activityEntry.findFirst({
    where: {
      id: candidateEntryId,
      userId: { in: connectionIds },
      deletedAt: null,
      activityId: { not: null },
    },
    include: { activity: true },
  });
  if (!candidateEntry?.activityId || !candidateEntry.activity) return false;

  const visibleActivityIds = await getVisibleActivityIdsForUsers([candidateEntry.userId]);
  if (!visibleActivityIds.has(candidateEntry.activityId)) return false;

  const score = scoreSharedActivityCandidate({
    sourceTitle: ownEntry.activity.title,
    sourceMeasure: ownEntry.activity.measure,
    sourceEmoji: ownEntry.activity.emoji,
    sourceDatetime: ownEntry.datetime,
    candidateTitle: candidateEntry.activity.title,
    candidateMeasure: candidateEntry.activity.measure,
    candidateEmoji: candidateEntry.activity.emoji,
    candidateDatetime: candidateEntry.datetime,
  });

  return score >= 50;
}

const activityEntryPhotoUpload = upload.fields([
  { name: "photo", maxCount: 10 },
  { name: "photos", maxCount: 10 },
]);

const getUploadedActivityEntryPhotos = (req: AuthenticatedRequest) => {
  const files = req.files as
    | { [fieldname: string]: Express.Multer.File[] }
    | undefined;

  return [...(files?.photo || []), ...(files?.photos || [])];
};

const uploadActivityEntryPhotos = async (
  photos: Express.Multer.File[],
  userId: string,
  activityEntryId: string
) => {
  return Promise.all(
    photos.map(async (photo) => {
      const photoId = uuidv4();
      const fileExtension = photo.originalname
        ? photo.originalname.split(".").pop()
        : "jpg";
      const s3Path = `/users/${userId}/activity_entries/${activityEntryId}/photos/${photoId}.${fileExtension}`;

      await s3Service.upload(photo.buffer, s3Path, photo.mimetype);

      return {
        s3Path,
        url: s3Service.getPublicUrl(s3Path),
      };
    })
  );
};

// Get all activities for user
router.get(
  "/",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const activities = await prisma.activity.findMany({
        where: {
          userId: req.user!.id,
          deletedAt: null,
        },
        orderBy: { createdAt: "desc" },
      });

      res.json(activities);
    } catch (error) {
      logger.error("Error fetching activities:", error);
      res.status(500).json({ error: "Failed to fetch activities" });
    }
  }
);

// Get all activity entries for user
router.get(
  "/activity-entries",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const entries = await prisma.activityEntry.findMany({
        where: {
          userId: req.user!.id,
          deletedAt: null,
          activityId: { not: null },
          activity: {
            deletedAt: null,
          },
        },
        include: {
          comments: {
            where: { deletedAt: null },
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  picture: true,
                },
              },
            },
            orderBy: { createdAt: "asc" },
          },
          reactions: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  picture: true,
                },
              },
            },
          },
          sharedActivityEntry: sharedActivityInclude,
        },
        orderBy: { createdAt: "desc" },
      });

      res.json(entries);
    } catch (error) {
      logger.error("Error fetching activity entries:", error);
      res.status(500).json({ error: "Failed to fetch activity entries" });
    }
  }
);

// Log activity entry
router.post(
  "/log-activity",
  requireAuth,
  activityEntryPhotoUpload,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      logger.info(
        `Logging activity for user ${req.user!.username} (${req.user!.id})`
      );
      const {
        activityId,
        iso_date_string,
        quantity,
        isPublic,
        description,
        timezone,
      } = req.body;
      const photos = getUploadedActivityEntryPhotos(req);

      // Check if activity exists and belongs to user
      const activity = await prisma.activity.findFirst({
        where: {
          id: activityId,
          userId: req.user!.id,
          deletedAt: null,
        },
      });

      if (!activity) {
        return res.status(404).json({ error: "Activity not found" });
      }

      // Check if entry already exists for this date
      const existingEntry = await prisma.activityEntry.findFirst({
        where: {
          activityId: activityId,
          userId: req.user!.id,
          datetime: iso_date_string,
          deletedAt: null,
        },
      });

      let entry: ActivityEntry;
      if (existingEntry) {
        // Update existing entry by adding quantity
        entry = await prisma.activityEntry.update({
          where: { id: existingEntry.id },
          data: {
            quantity: existingEntry.quantity + parseInt(quantity),
            description: description || existingEntry.description,
          },
        });
      } else {
        // Create new entry
        entry = await prisma.activityEntry.create({
          data: {
            activityId: activityId,
            userId: req.user!.id,
            quantity: parseInt(quantity),
            datetime: iso_date_string,
            description,
            timezone,
          },
        });
      }

      // Handle photo upload if provided
      if (photos.length > 0) {
        try {
          const uploadedImages = await uploadActivityEntryPhotos(
            photos,
            req.user!.id,
            entry.id
          );

          // Update entry with image information
          entry = await prisma.activityEntry.update({
            where: { id: entry.id },
            data: buildActivityEntryImageUpdate(
              entry,
              uploadedImages,
              isPublic === "true" || isPublic === true
            ),
          });

          logger.info(
            `${uploadedImages.length} photo(s) uploaded successfully to S3 for activity entry ${entry.id}`
          );

          // Create notifications for connected users about the photo
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

            for (const connectedUser of connectedUsers) {
              const message = `${req.user!.username} logged ${quantity} ${activity.measure} of ${activity.emoji} ${activity.title} with ${uploadedImages.length === 1 ? "a photo" : `${uploadedImages.length} photos`} 📸!`;
              await notificationService.createAndProcessNotification({
                userId: connectedUser.id,
                message,
                type: "INFO",
                relatedId: entry.id,
                relatedData: {
                  activityEntryId: entry.id,
                  userPicture: req.user!.picture,
                  userName: req.user!.name,
                  userUsername: req.user!.username,
                },
              });
            }
          }
        } catch (error) {
          logger.error("Error uploading photo to S3:", error);
          // Continue without photo - don't fail the entire activity logging
        }
      } else {
        logger.info("No photo provided");
      }

      // Update user's last active time
      await prisma.user.update({
        where: { id: req.user!.id },
        data: {
          lastActiveAt: new Date(),
        },
      });

      // TODO: Add plan state processing
      const plans = await prisma.plan.findMany({
        where: {
          userId: req.user!.id,
          activities: {
            some: {
              id: activityId,
            },
          },
        },
      });

      // Invalidate progress cache for affected plans
      if (plans.length > 0) {
        await plansService.invalidateUserPlanProgressCaches(req.user!.id, [
          activityId,
        ]);
      }

      // Find coached plan and recalculate its state
      for (const plan of plans) {
        if (plan.isCoached) {
          // only coach the coached plan
          plansService.recalculateCurrentWeekState(plan, req.user!);

          // Schedule post-activity celebration message (30-90 seconds after logging)
          // Use a random delay to make it feel more natural
          const delayMs = 30000 + Math.random() * 60000; // 30s to 90s
          setTimeout(async () => {
            try {
              // Fetch fresh plan data with activities
              const planWithActivities = await prisma.plan.findUnique({
                where: { id: plan.id },
                include: { activities: true },
              });

              if (planWithActivities) {
                await plansService.processPostActivityCoaching(
                  req.user!,
                  planWithActivities,
                  entry
                );
              }
            } catch (error) {
              logger.error(
                `Error in delayed post-activity coaching for user ${req.user!.username}:`,
                error
              );
              // Silently fail - don't affect the user experience
            }
          }, delayMs);

          logger.info(
            `Scheduled post-activity coaching for user ${req.user!.username} in ${Math.round(delayMs / 1000)}s`
          );
        } else {
          logger.info(`Plan '${plan.goal}' is not coached, skipping`);
        }
      }

      // Invalidate progress cache for all plans using this activity
      // This ensures the next fetch will recompute progress with fresh data
      await prisma.plan.updateMany({
        where: {
          userId: req.user!.id,
          activities: {
            some: { id: activityId },
          },
        },
        data: { progressCalculatedAt: null },
      });

      const sharedActivityCandidates = await findSharedActivityCandidates(entry.id, req.user!.id);
      res.json({ ...entry, entry, sharedActivityCandidates });
    } catch (error) {
      logger.error("Error logging activity:", error);
      res.status(500).json({ error: "Failed to log activity" });
    }
  }
);

// Get recent activities
router.get(
  "/recent-activities",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const recentEntries = await prisma.activityEntry.findMany({
        where: {
          userId: req.user!.id,
          deletedAt: null,
          activityId: { not: null },
          activity: { deletedAt: null },
        },
        include: {
          activity: true,
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      });

      const recentActivities = recentEntries
        .filter((entry) => entry.activity !== null)
        .map((entry) => ({
          id: entry.id,
          activity_title: entry.activity!.title,
          activity_emoji: entry.activity!.emoji,
          quantity: entry.quantity,
          measure: entry.activity!.measure,
          datetime: entry.datetime,
          createdAt: entry.createdAt,
        }));

      res.json({ recent_activities: recentActivities });
    } catch (error) {
      logger.error("Error fetching recent activities:", error);
      res.status(500).json({ error: "Failed to fetch recent activities" });
    }
  }
);

// Upsert activity
router.post(
  "/upsert",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      let { id, title, measure, emoji, colorHex } = req.body;

      if (!id) {
        id = uuidv4();
      }

      const activity = await prisma.activity.upsert({
        where: { id },
        update: {
          userId: req.user!.id,
          title,
          measure,
          emoji,
          colorHex,
        },
        create: {
          id,
          userId: req.user!.id,
          title,
          measure,
          emoji,
          colorHex,
        },
      });

      res.json(activity);
    } catch (error) {
      logger.error("Error upserting activity:", error);
      res.status(500).json({ error: "Failed to upsert activity" });
    }
  }
);

// Update activity entry
router.put(
  "/activity-entries/:activityEntryId",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const { activityEntryId } = req.params;
      const { quantity, datetime, description, difficulty } = req.body;

      // Verify ownership
      const existingEntry = await prisma.activityEntry.findFirst({
        where: {
          id: activityEntryId,
          userId: req.user!.id,
          deletedAt: null,
        },
      });

      if (!existingEntry) {
        return res.status(404).json({ error: "Activity entry not found" });
      }

      const updatedEntry = await prisma.activityEntry.update({
        where: { id: activityEntryId },
        data: {
          quantity: quantity !== undefined ? quantity : existingEntry.quantity,
          datetime:
            datetime !== undefined ? new Date(datetime) : existingEntry.datetime,
          description:
            description !== undefined ? description : existingEntry.description,
          difficulty:
            difficulty !== undefined ? difficulty : existingEntry.difficulty,
        },
      });

      // Invalidate progress cache for all plans using this activity
      // This ensures the next fetch will recompute progress with fresh data
      if (existingEntry.activityId) {
        await prisma.plan.updateMany({
          where: {
            userId: req.user!.id,
            activities: {
              some: { id: existingEntry.activityId },
            },
          },
          data: { progressCalculatedAt: null },
        });
      }

      res.json(updatedEntry);
    } catch (error) {
      logger.error("Error updating activity entry:", error);
      res.status(500).json({ error: "Failed to update activity entry" });
    }
  }
);

// Add or update photo for activity entry (only entries from last 7 days)
router.put(
  "/activity-entries/:activityEntryId/photo",
  requireAuth,
  activityEntryPhotoUpload,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const { activityEntryId } = req.params;
      const photos = getUploadedActivityEntryPhotos(req);

      if (photos.length === 0) {
        return res.status(400).json({ error: "No photos provided" });
      }

      // Verify ownership
      const existingEntry = await prisma.activityEntry.findFirst({
        where: {
          id: activityEntryId,
          userId: req.user!.id,
          deletedAt: null,
        },
      });

      if (!existingEntry) {
        return res.status(404).json({ error: "Activity entry not found" });
      }

      // Check if entry is within last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      if (existingEntry.createdAt < sevenDaysAgo) {
        return res.status(403).json({
          error: "Can only edit photos for activity entries from the last 7 days",
        });
      }

      const uploadedImages = await uploadActivityEntryPhotos(
        photos,
        req.user!.id,
        existingEntry.id
      );

      // Append new images while preserving existing ones
      const updatedEntry = await prisma.activityEntry.update({
        where: { id: activityEntryId },
        data: buildActivityEntryImageUpdate(existingEntry, uploadedImages),
      });

      logger.info(
        `${uploadedImages.length} photo(s) added successfully for activity entry ${activityEntryId}`
      );

      res.json(updatedEntry);
    } catch (error) {
      logger.error("Error updating activity entry photo:", error);
      res.status(500).json({ error: "Failed to update photo" });
    }
  }
);

// Delete photo from activity entry (only entries from last 7 days)
router.delete(
  "/activity-entries/:activityEntryId/photo",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const { activityEntryId } = req.params;

      // Verify ownership
      const existingEntry = await prisma.activityEntry.findFirst({
        where: {
          id: activityEntryId,
          userId: req.user!.id,
          deletedAt: null,
        },
      });

      if (!existingEntry) {
        return res.status(404).json({ error: "Activity entry not found" });
      }

      // Check if entry is within last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      if (existingEntry.createdAt < sevenDaysAgo) {
        return res.status(403).json({
          error: "Can only delete photos for activity entries from the last 7 days",
        });
      }

      const imageS3Paths = Array.from(
        new Set([
          ...((existingEntry as typeof existingEntry & { imageS3Paths?: string[] })
            .imageS3Paths || []),
          existingEntry.imageS3Path,
        ].filter((path): path is string => !!path))
      );

      if (imageS3Paths.length === 0) {
        return res.status(404).json({ error: "No photo to delete" });
      }

      // Delete photos from S3
      for (const imageS3Path of imageS3Paths) {
        try {
          await s3Service.delete(imageS3Path);
          logger.info(`Deleted photo from S3: ${imageS3Path}`);
        } catch (error) {
          logger.warn(`Failed to delete photo from S3: ${imageS3Path}`, error);
        }
      }

      // Clear image fields
      const updatedEntry = await prisma.activityEntry.update({
        where: { id: activityEntryId },
        data: {
          imageS3Path: null,
          imageUrl: null,
          imageS3Paths: [],
          imageUrls: [],
          imageExpiresAt: null,
          imageCreatedAt: null,
        },
      });

      logger.info(`Photo deleted for activity entry ${activityEntryId}`);

      res.json(updatedEntry);
    } catch (error) {
      logger.error("Error deleting activity entry photo:", error);
      res.status(500).json({ error: "Failed to delete photo" });
    }
  }
);

// Modify reactions for activity entry (unified add/remove)
router.post(
  "/activity-entries/:activityEntryId/modify-reactions",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const { activityEntryId } = req.params;
      const { reactions } = req.body;

      if (!Array.isArray(reactions) || !reactions.length) {
        return res.status(400).json({ error: "No reactions provided" });
      }

      // Process each reaction operation
      const addedEmojis: string[] = [];
      const removedEmojis: string[] = [];

      for (const { emoji, operation } of reactions) {
        if (!emoji || !operation) {
          continue;
        }

        if (operation === "add") {
          await prisma.reaction.upsert({
            where: {
              activityEntryId_userId_emoji: {
                activityEntryId,
                userId: req.user!.id,
                emoji,
              },
            },
            update: {},
            create: {
              activityEntryId,
              userId: req.user!.id,
              emoji,
            },
          });
          addedEmojis.push(emoji);
        } else if (operation === "remove") {
          await prisma.reaction.deleteMany({
            where: {
              activityEntryId,
              userId: req.user!.id,
              emoji,
            },
          });
          removedEmojis.push(emoji);
        }
      }

      // Create notification only for added reactions
      if (addedEmojis.length > 0) {
        const activityEntry = await prisma.activityEntry.findUnique({
          where: { id: activityEntryId },
          include: { user: true },
        });

        if (activityEntry && activityEntry.userId !== req.user!.id) {
          const emojiText =
            addedEmojis.length <= 3
              ? addedEmojis.join(" ")
              : `${addedEmojis.slice(0, 3).join(" ")} and ${addedEmojis.length - 3} more`;

          await notificationService.createAndProcessNotification({
            userId: activityEntry.userId,
            message: `@${req.user!.username} reacted to your activity with ${emojiText}`,
            type: "INFO",
            relatedId: activityEntryId,
            relatedData: {
              activityEntryId: activityEntryId,
              reactorPicture: req.user!.picture,
              reactorName: req.user!.name,
              reactorUsername: req.user!.username,
              batchCategory: "REACTIONS",
            },
          }, false);
        }
      }

      // Get updated reactions
      const activityEntryReactions = await prisma.reaction.findMany({
        where: {
          activityEntryId,
        },
        include: {
          user: { select: { username: true, picture: true, name: true } },
        },
      });

      res.json({
        message: "Reactions modified successfully",
        reactions: activityEntryReactions,
      });
    } catch (error) {
      logger.error("Error modifying reactions:", error);
      res.status(500).json({ error: "Failed to modify reactions" });
    }
  }
);

// Add reaction to activity entry (legacy endpoint - kept for backwards compatibility)
router.post(
  "/activity-entries/:activityEntryId/reactions",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const { activityEntryId } = req.params;
      const { emoji, emojis, operation } = req.body;

      const emojiList = emojis || (emoji ? [emoji] : []);

      if (!emojiList.length) {
        return res.status(400).json({ error: "No emojis provided" });
      }

      if (operation === "add") {
        for (const e of emojiList) {
          await prisma.reaction.upsert({
            where: {
              activityEntryId_userId_emoji: {
                activityEntryId,
                userId: req.user!.id,
                emoji: e,
              },
            },
            update: {},
            create: {
              activityEntryId,
              userId: req.user!.id,
              emoji: e,
            },
          });
        }

        // Get activity entry to notify owner
        const activityEntry = await prisma.activityEntry.findUnique({
          where: { id: activityEntryId },
          include: { user: true },
        });

        if (activityEntry && activityEntry.userId !== req.user!.id) {
          const emojiText =
            emojiList.length <= 3
              ? emojiList.join(" ")
              : `${emojiList.slice(0, 3).join(" ")} and ${emojiList.length - 3} more`;

          await notificationService.createAndProcessNotification({
            userId: activityEntry.userId,
            message: `@${req.user!.username} reacted to your activity with ${emojiText}`,
            type: "INFO",
            relatedId: activityEntryId,
            relatedData: {
              activityEntryId: activityEntryId,
              reactorPicture: req.user!.picture,
              reactorName: req.user!.name,
              reactorUsername: req.user!.username,
              batchCategory: "REACTIONS",
            },
          }, false);
        }

        const activityEntryReactions = await prisma.reaction.findMany({
          where: {
            activityEntryId,
          },
          include: {
            user: { select: { username: true, picture: true, name: true } },
          },
        });
        res.json({
          message: "Reactions added successfully",
          reactions: activityEntryReactions,
        });
      } else if (operation === "remove") {
        for (const e of emojiList) {
          await prisma.reaction.deleteMany({
            where: {
              activityEntryId,
              userId: req.user!.id,
              emoji: e,
            },
          });
        }

        const activityEntryReactions = await prisma.reaction.findMany({
          where: {
            activityEntryId,
          },
          include: {
            user: { select: { username: true, picture: true, name: true } },
          },
        });
        res.json({
          message: "Reactions removed successfully",
          reactions: activityEntryReactions,
        });
      } else {
        res.status(400).json({ error: "Invalid operation" });
      }
    } catch (error) {
      logger.error("Error managing reactions:", error);
      res.status(500).json({ error: "Failed to manage reactions" });
    }
  }
);

// Get reactions for activity entry
router.get(
  "/activity-entries/:activityEntryId/reactions",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const { activityEntryId } = req.params;

      const reactions = await prisma.reaction.findMany({
        where: { activityEntryId },
        include: { user: { select: { username: true } } },
      });

      // Group reactions by emoji
      const reactionsGrouped: { [emoji: string]: string[] } = {};
      reactions.forEach((reaction) => {
        if (!reactionsGrouped[reaction?.emoji]) {
          reactionsGrouped[reaction?.emoji] = [];
        }
        reactionsGrouped[reaction?.emoji].push(reaction?.user?.username!);
      });

      res.json({ reactions: reactionsGrouped });
    } catch (error) {
      logger.error("Error getting reactions:", error);
      res.status(500).json({ error: "Failed to get reactions" });
    }
  }
);

// Delete activity
router.delete(
  "/:activityId",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const { activityId } = req.params;

      // Verify ownership
      const activity = await prisma.activity.findFirst({
        where: {
          id: activityId,
          userId: req.user!.id,
          deletedAt: null,
        },
      });

      if (!activity) {
        return res.status(404).json({ error: "Activity not found" });
      }

      // Soft delete
      await prisma.activity.update({
        where: { id: activityId },
        data: { deletedAt: new Date() },
      });

      // Invalidate progress cache for all plans using this activity
      // This ensures the next fetch will recompute progress with fresh data
      await prisma.plan.updateMany({
        where: {
          userId: req.user!.id,
          activities: {
            some: { id: activityId },
          },
        },
        data: { progressCalculatedAt: null },
      });

      res.json({ message: "Activity deleted successfully" });
    } catch (error) {
      logger.error("Error deleting activity:", error);
      res.status(500).json({ error: "Failed to delete activity" });
    }
  }
);


router.get(
  "/activity-entries/:activityEntryId/shared-candidates",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const candidates = await findSharedActivityCandidates(
        req.params.activityEntryId,
        req.user!.id
      );
      res.json({ candidates });
    } catch (error) {
      logger.error("Error finding shared activity candidates:", error);
      res.status(500).json({ error: "Failed to find shared activity candidates" });
    }
  }
);

router.post(
  "/activity-entries/:activityEntryId/shared-link",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const { activityEntryId } = req.params;
      const { candidateActivityEntryId } = req.body;

      if (!candidateActivityEntryId || typeof candidateActivityEntryId !== "string") {
        return res.status(400).json({ error: "candidateActivityEntryId is required" });
      }

      const canLink = await canLinkActivityEntries(
        req.user!.id,
        activityEntryId,
        candidateActivityEntryId
      );
      if (!canLink) {
        return res.status(403).json({ error: "Activity entries cannot be linked" });
      }

      const [ownLink, candidateLink, candidateEntry] = await Promise.all([
        prisma.sharedActivityEntry.findUnique({ where: { activityEntryId } }),
        prisma.sharedActivityEntry.findUnique({ where: { activityEntryId: candidateActivityEntryId } }),
        prisma.activityEntry.findUnique({ where: { id: candidateActivityEntryId } }),
      ]);

      if (!candidateEntry) {
        return res.status(404).json({ error: "Candidate activity entry not found" });
      }

      if (ownLink && candidateLink && ownLink.sharedActivityId !== candidateLink.sharedActivityId) {
        return res.status(409).json({ error: "Entries are already linked to different shared activities" });
      }

      const sharedActivityId =
        ownLink?.sharedActivityId ||
        candidateLink?.sharedActivityId ||
        (await prisma.sharedActivity.create({ data: { createdById: req.user!.id } })).id;

      const duplicateUserLink = await prisma.sharedActivityEntry.findFirst({
        where: {
          sharedActivityId,
          userId: { in: [req.user!.id, candidateEntry.userId] },
          activityEntryId: { notIn: [activityEntryId, candidateActivityEntryId] },
        },
      });

      if (duplicateUserLink) {
        return res.status(409).json({ error: "User already has an entry in this shared activity" });
      }

      await prisma.sharedActivityEntry.upsert({
        where: { activityEntryId },
        update: { sharedActivityId, userId: req.user!.id },
        create: { sharedActivityId, activityEntryId, userId: req.user!.id },
      });

      await prisma.sharedActivityEntry.upsert({
        where: { activityEntryId: candidateActivityEntryId },
        update: { sharedActivityId, userId: candidateEntry.userId },
        create: {
          sharedActivityId,
          activityEntryId: candidateActivityEntryId,
          userId: candidateEntry.userId,
        },
      });

      const sharedActivity = await prisma.sharedActivity.findUnique({
        where: { id: sharedActivityId },
        include: {
          entries: {
            include: {
              user: { select: { id: true, username: true, name: true, picture: true } },
              activityEntry: true,
            },
          },
        },
      });

      await notificationService.createAndProcessNotification({
        userId: candidateEntry.userId,
        message: `@${req.user!.username} linked an activity with you`,
        type: "INFO",
        relatedId: sharedActivityId,
        relatedData: {
          sharedActivityId,
          activityEntryId,
          linkedByUsername: req.user!.username,
          linkedByName: req.user!.name,
          linkedByPicture: req.user!.picture,
        },
      });

      res.json({ sharedActivity });
    } catch (error) {
      logger.error("Error linking shared activity:", error);
      res.status(500).json({ error: "Failed to link shared activity" });
    }
  }
);

router.delete(
  "/activity-entries/:activityEntryId/shared-link",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const link = await prisma.sharedActivityEntry.findFirst({
        where: {
          activityEntryId: req.params.activityEntryId,
          userId: req.user!.id,
        },
      });

      if (!link) {
        return res.status(404).json({ error: "Shared activity link not found" });
      }

      await prisma.sharedActivityEntry.delete({ where: { id: link.id } });

      const remaining = await prisma.sharedActivityEntry.count({
        where: { sharedActivityId: link.sharedActivityId },
      });

      if (remaining < 2) {
        await prisma.sharedActivity.delete({ where: { id: link.sharedActivityId } }).catch(() => null);
      }

      res.json({ success: true });
    } catch (error) {
      logger.error("Error unlinking shared activity:", error);
      res.status(500).json({ error: "Failed to unlink shared activity" });
    }
  }
);

// Delete activity entry
router.delete(
  "/activity-entries/:activityEntryId",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const { activityEntryId } = req.params;

      // Verify ownership
      const activityEntry = await prisma.activityEntry.findFirst({
        where: {
          id: activityEntryId,
          userId: req.user!.id,
          deletedAt: null,
        },
      });

      if (!activityEntry) {
        return res.status(404).json({ error: "Activity entry not found" });
      }

      // Soft delete
      await prisma.activityEntry.update({
        where: { id: activityEntryId },
        data: { deletedAt: new Date() },
      });

      // Invalidate progress cache for all plans using this activity
      // This ensures the next fetch will recompute progress with fresh data
      if (activityEntry.activityId) {
        await prisma.plan.updateMany({
          where: {
            userId: req.user!.id,
            activities: {
              some: { id: activityEntry.activityId },
            },
          },
          data: { progressCalculatedAt: null },
        });
      }

      res.json({ message: "Activity entry deleted successfully" });
    } catch (error) {
      logger.error("Error deleting activity entry:", error);
      res.status(500).json({ error: "Failed to delete activity entry" });
    }
  }
);

// Add comment to activity entry
router.post(
  "/activity-entries/:activityEntryId/comments",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const { activityEntryId } = req.params;
      const { text } = req.body;

      const comment = await prisma.comment.create({
        data: {
          activityEntryId,
          userId: req.user!.id,
          text,
        },
      });

      // Get activity entry to notify owner
      const activityEntry = await prisma.activityEntry.findUnique({
        where: { id: activityEntryId },
      });

      // Set to track users who have been notified (to prevent duplicates)
      const notifiedUserIds = new Set<string>();

      // Notify activity entry owner (if not the commenter)
      if (activityEntry && activityEntry.userId !== req.user!.id) {
        const truncatedText =
          text.length > 30 ? `${text.slice(0, 30)}...` : text;
        await notificationService.createAndProcessNotification({
          userId: activityEntry.userId,
          message: `@${req.user!.username} commented on your activity: "${truncatedText}"`,
          type: "INFO",
          relatedId: activityEntryId,
          relatedData: {
            activityEntryId: activityEntryId,
            commenterId: req.user!.id,
            commenterPicture: req.user!.picture,
            commenterName: req.user!.name,
            commenterUsername: req.user!.username,
          },
        });
        notifiedUserIds.add(activityEntry.userId);
      }

      // Extract @mentions from comment text
      const mentionRegex = /@([a-zA-Z0-9_]+)/g;
      const mentions = [...text.matchAll(mentionRegex)];

      if (mentions.length > 0) {
        // Get unique usernames
        const uniqueUsernames = [
          ...new Set(mentions.map((m) => m[1].toLowerCase())),
        ];

        // Look up mentioned users
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

        // Send notifications to mentioned users
        for (const mentionedUser of mentionedUsers) {
          // Skip if user is the commenter or already notified
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
            relatedId: activityEntryId,
            relatedData: {
              activityEntryId: activityEntryId,
              commenterId: req.user!.id,
              commenterPicture: req.user!.picture,
              commenterName: req.user!.name,
              commenterUsername: req.user!.username,
            },
          });

          notifiedUserIds.add(mentionedUser.id);
        }
      }

      // Get all comments for this activity entry to return the updated list
      const allComments = await prisma.comment.findMany({
        where: {
          activityEntryId,
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

// Remove comment from activity entry
router.delete(
  "/activity-entries/:activityEntryId/comments/:commentId",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const { activityEntryId, commentId } = req.params;

      // Verify ownership
      const comment = await prisma.comment.findFirst({
        where: {
          id: commentId,
          activityEntryId,
          userId: req.user!.id,
        },
      });

      if (!comment) {
        return res.status(404).json({ error: "Comment not found" });
      }

      await prisma.comment.delete({
        where: { id: commentId },
      });

      // Get all remaining comments for this activity entry to return the updated list
      const allComments = await prisma.comment.findMany({
        where: {
          activityEntryId,
        },
        include: {
          user: { select: { username: true, picture: true, name: true } },
        },
        orderBy: { createdAt: "asc" },
      });

      res.json({
        message: "Comment removed successfully",
        comments: allComments,
      });
    } catch (error) {
      logger.error("Error removing comment:", error);
      res.status(500).json({ error: "Failed to remove comment" });
    }
  }
);

export const activitiesRouter: Router = router;
export default activitiesRouter;
