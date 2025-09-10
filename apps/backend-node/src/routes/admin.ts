import { TelegramService } from "@/services/telegramService";
import { User } from "@tsw/prisma";
import { NextFunction, Request, Response, Router } from "express";
import rateLimit from "express-rate-limit";
import { notificationService } from "../services/notificationService";
import { recommendationsService } from "../services/recommendationsService";
import { s3Service } from "../services/s3Service";
import { sesService } from "../services/sesService";
import { userService } from "../services/userService";
import { logger } from "../utils/logger";
import { prisma } from "../utils/prisma";

const telegramService = new TelegramService();
interface AdminRequest extends Request {
  adminVerified?: boolean;
}

const router = Router();

// Rate limiter for public endpoints
const publicRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute
  message: "Too many requests, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

// Admin authentication middleware
const adminAuth = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res
        .status(401)
        .json({ error: "Missing or invalid authorization header" });
      return;
    }

    const token = authHeader.substring(7);
    const adminApiKey = process.env.ADMIN_API_KEY;

    if (!adminApiKey) {
      logger.error("Admin API key not set in environment");
      res.status(500).json({ error: "Admin API key not configured" });
      return;
    }

    if (token !== adminApiKey) {
      res.status(401).json({ error: "Invalid admin token" });
      return;
    }

    req.adminVerified = true;
    next();
  } catch (error) {
    logger.error("Admin auth error:", error);
    res.status(500).json({ error: "Authentication failed" });
  }
};

// Send notification to specific user
router.post(
  "/send-notification",
  adminAuth,
  async (req: AdminRequest, res: Response): Promise<Response | void> => {
    try {
      const {
        userId,
        message,
        type = "INFO",
        relatedId,
        relatedData,
      } = req.body;

      if (!userId || !message) {
        res.status(400).json({ error: "userId and message are required" });
        return;
      }

      await notificationService.createAndProcessNotification({
        userId: userId,
        message,
        type: type.toUpperCase(),
        relatedId: relatedId,
        relatedData: relatedData,
      });

      res.json({ message: "Notification sent successfully" });
    } catch (error) {
      logger.error("Error sending notification:", error);
      res.status(500).json({ error: "Failed to send notification" });
    }
  }
);

// Send notification to all users
router.post(
  "/send-notification-to-all-users",
  adminAuth,
  async (req: AdminRequest, res: Response): Promise<Response | void> => {
    try {
      const {
        message,
        type = "INFO",
        relatedId,
        relatedData,
        filter_usernames = [],
      } = req.body;

      if (!message) {
        return res.status(400).json({ error: "message is required" });
      }

      let users;
      if (filter_usernames.length > 0) {
        users = await prisma.user.findMany({
          where: {
            username: { in: filter_usernames },
            deletedAt: null,
          },
        });
      } else {
        users = await userService.getAllUsers();
      }

      let sent = 0;
      for (const user of users) {
        await notificationService.createAndProcessNotification({
          userId: user.id,
          message,
          type: type.toUpperCase(),
          relatedId: relatedId,
          relatedData: relatedData,
        });
        sent++;
      }

      res.json({ message: `Notification sent successfully to ${sent} users` });
    } catch (error) {
      logger.error("Error sending notifications to all users:", error);
      res.status(500).json({ error: "Failed to send notifications" });
    }
  }
);

// Regenerate S3 presigned URL for activity entry image
router.post(
  "/regenerate-image-url",
  adminAuth,
  async (req: AdminRequest, res: Response): Promise<Response | void> => {
    try {
      const { activity_entry_id, expiration_days = 7 } = req.body;

      if (!activity_entry_id) {
        return res.status(400).json({ error: "activity_entry_id is required" });
      }

      const activityEntry = await prisma.activityEntry.findUnique({
        where: { id: activity_entry_id },
      });

      if (!activityEntry) {
        return res.status(404).json({ error: "Activity entry not found" });
      }

      if (!activityEntry.imageS3Path) {
        return res.status(400).json({ error: "Activity entry has no image" });
      }

      // Generate new presigned URL
      const expirationSeconds = expiration_days * 24 * 60 * 60;
      const newUrl = await s3Service.generatePresignedUrl(
        activityEntry.imageS3Path,
        expirationSeconds
      );

      // Update the activity entry with new URL and expiration
      const expiresAt = new Date(Date.now() + expirationSeconds * 1000);

      await prisma.activityEntry.update({
        where: { id: activity_entry_id },
        data: {
          imageUrl: newUrl,
          imageExpiresAt: expiresAt,
        },
      });

      res.json({
        url: newUrl,
        expires_at: expiresAt.toISOString(),
        s3_path: activityEntry.imageS3Path,
      });
    } catch (error) {
      logger.error("Error regenerating image URL:", error);
      res.status(500).json({ error: "Failed to regenerate image URL" });
    }
  }
);

// Get all users (admin only)
router.get(
  "/users",
  adminAuth,
  async (_req: AdminRequest, res: Response): Promise<Response | void> => {
    try {
      const users = await userService.getAllUsers();
      res.json({ users, count: users.length });
    } catch (error) {
      logger.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  }
);

// Get user statistics
router.get(
  "/stats",
  adminAuth,
  async (_req: AdminRequest, res: Response): Promise<Response | void> => {
    try {
      const [
        totalUsers,
        totalActivities,
        totalActivityEntries,
        totalNotifications,
        paidUsers,
      ] = await Promise.all([
        prisma.user.count({ where: { deletedAt: null } }),
        prisma.activity.count({ where: { deletedAt: null } }),
        prisma.activityEntry.count({ where: { deletedAt: null } }),
        prisma.notification.count(),
        prisma.user.count({ where: { deletedAt: null, planType: "PLUS" } }),
      ]);

      res.json({
        users: {
          total: totalUsers,
          paid: paidUsers,
          free: totalUsers - paidUsers,
        },
        activities: totalActivities,
        activity_entries: totalActivityEntries,
        notifications: totalNotifications,
      });
    } catch (error) {
      logger.error("Error fetching stats:", error);
      res.status(500).json({ error: "Failed to fetch statistics" });
    }
  }
);

// Public error logging endpoint (with rate limiting)
const ALLOWED_ORIGINS = new Set([
  "https://tracking.so",
  "https://app.tracking.so",
  "http://localhost:3001",
]);

const BLACKLISTED_IPS = new Set<string>();
const MAX_ERROR_LENGTH = 1000;

interface ErrorLogRequest {
  error_message: string;
  user_clerk_id?: string;
  error_digest?: string;
  url: string;
  referrer: string;
  user_agent?: string;
  timestamp: string;
}

router.post(
  "/public/log-error",
  publicRateLimit,
  async (req: Request, res: Response): Promise<Response | void> => {
    try {
      // Security checks
      const origin = req.headers.origin;
      if (!origin || !ALLOWED_ORIGINS.has(origin)) {
        logger.warn(`Blocked request from unauthorized origin: ${origin}`);
        return res.status(403).json({ error: "Invalid origin" });
      }

      const clientIp = req.ip || req.socket.remoteAddress || "unknown";
      if (BLACKLISTED_IPS.has(clientIp)) {
        logger.warn(`Blocked request from blacklisted IP: ${clientIp}`);
        return res.status(403).json({ error: "IP blocked" });
      }

      const errorData: ErrorLogRequest = req.body;

      // Validate error message length
      if (errorData.error_message?.length > MAX_ERROR_LENGTH) {
        return res.status(400).json({ error: "Error message too long" });
      }

      // Get user if exists
      let user: User | null = null;
      if (errorData.user_clerk_id) {
        try {
          user = await userService.getUserByClerkId(errorData.user_clerk_id);
        } catch (error) {
          logger.warn(
            `User with clerk_id '${errorData.user_clerk_id}' not found`
          );
        }
      }

      // Create error context
      const context = {
        user_clerk_id: errorData.user_clerk_id,
        user_username: user?.username || "unknown",
        error_message: errorData.error_message,
        error_digest: errorData.error_digest,
        url: errorData.url,
        referrer: errorData.referrer,
        user_agent: errorData.user_agent,
        timestamp: errorData.timestamp,
        ip: clientIp,
        environment: process.env.NODE_ENV || "development",
        origin,
      };

      // Log the error
      logger.error("Client Error", { extra: context });

      telegramService.sendErrorNotification({
        errorMessage: `ERROR IN FRONTEND: ${errorData.error_message}`,
        userUsername: user?.username || "unknown",
        userId: user?.id || "unknown",
      });

      res.json({ status: "success" });
    } catch (error) {
      logger.error("Failed to log client error:", error);
      res.status(500).json({ error: "Failed to log error" });
    }
  }
);

// Run daily metrics notification
router.post(
  "/run-daily-metrics-notification",
  adminAuth,
  async (req: AdminRequest, res: Response): Promise<Response | void> => {
    try {
      logger.info(
        "Daily metrics notification endpoint called - currently disabled"
      );

      // TODO: Implement metrics notification logic when metrics system is ready
      const {
        filter_usernames = [],
        send_report = false,
        dry_run = true,
      } = req.body;

      res.json({
        message: "Metrics notification disabled for now",
        dry_run,
        filter_usernames,
        send_report,
        notifications_processed: [],
      });
    } catch (error) {
      logger.error("Error in daily metrics notification:", error);
      res
        .status(500)
        .json({ error: "Failed to run daily metrics notification" });
    }
  }
);

// Run hourly job (for plan coaching)
router.post(
  "/run-hourly-job",
  adminAuth,
  async (req: AdminRequest, res: Response): Promise<Response | void> => {
    try {
      logger.info("Starting hourly job execution");

      const { filter_usernames = [] } = req.body;

      // Get paid users with plans
      let users = await userService.getAllPaidUsers();

      if (filter_usernames.length > 0) {
        users = users.filter((user) =>
          filter_usernames.includes(user.username)
        );
      }

      // Filter users who have plans
      const usersWithPlans = users.filter((user) => {
        return user.plans && user.plans.length > 0;
      });

      let tasksStarted = 0;
      const startedForUsers: string[] = [];

      // TODO: Implement timezone-based hour checking and plan coaching
      // For now, just log the intent
      for (const user of usersWithPlans) {
        logger.info(`Would process plan coaching for user: ${user.username}`);
        tasksStarted++;
        startedForUsers.push(user.username || "unknown");
      }

      logger.info(
        `Hourly job completed. Would start ${tasksStarted} background tasks out of ${users.length} users checked`
      );

      res.json({
        message: `Would start background tasks for ${tasksStarted} users (plan system not yet implemented)`,
        started_for_users: startedForUsers,
        total_users_checked: users.length,
      });
    } catch (error) {
      logger.error("Error in hourly job:", error);
      res.status(500).json({ error: "Failed to run hourly job" });
    }
  }
);

// Helper function to process unactivated emails
const processUnactivatedEmails = async (
  users: User[],
  dryRun: boolean = true
) => {
  const unactivatedUsers: User[] = [];

  for (const user of users) {
    const userActivities = await prisma.activityEntry.findMany({
      where: {
        userId: user.id,
        deletedAt: null,
      },
    });

    const activityDays = new Set(
      userActivities.map((entry) => entry.createdAt.toISOString().split("T")[0])
    );

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    if (user.createdAt < weekAgo && activityDays.size <= 1) {
      unactivatedUsers.push(user);
    }
  }

  if (dryRun) {
    return {
      message: "Email sending skipped (dry run)",
      would_email: unactivatedUsers.length,
      would_email_usernames: unactivatedUsers.map((u: any) => u.username),
    };
  }

  const triggeredUserUsernames: string[] = [];
  for (const user of unactivatedUsers) {
    if (user.unactivatedEmailSentAt) {
      logger.info(
        `Unactivated email already sent to '${user.username}', skipping`
      );
      continue;
    }

    // TODO: Implement loops email service
    logger.info(`Would send unactivated email to ${user.email}`);

    await prisma.user.update({
      where: { id: user.id },
      data: { unactivatedEmailSentAt: new Date() },
    });

    if (user.username) {
      triggeredUserUsernames.push(user.username);
    }
  }

  return {
    emails_sent: triggeredUserUsernames.length,
    emailed_usernames: triggeredUserUsernames,
    unactivated_users_count: unactivatedUsers.length,
  };
};

// Run daily job
router.post(
  "/run-daily-job",
  adminAuth,
  async (req: AdminRequest, res: Response): Promise<Response | void> => {
    try {
      const {
        filter_usernames = [],
        dry_run = { unactivated_emails: true, notifications: true },
        send_report = false,
      } = req.body;

      const unactivatedEmailsDryRun = dry_run.unactivated_emails !== false;

      logger.info(
        `Running daily job with filter_usernames: ${filter_usernames} and unactivated_emails_dry_run: ${unactivatedEmailsDryRun}`
      );

      // Get all users or subset if specified
      let allUsers = await userService.getAllUsers();

      if (filter_usernames.length > 0) {
        allUsers = allUsers.filter((user) =>
          filter_usernames.includes(user.username)
        );
      }

      // Process unactivated emails
      const unactivatedEmailsResult = await processUnactivatedEmails(
        allUsers,
        unactivatedEmailsDryRun
      );

      // TODO: Process recommendations outdated logic when recommendations system is ready
      const recommendationsOutdatedResult: string[] = [];

      const result = {
        dry_run: {
          unactivated_emails: unactivatedEmailsDryRun,
        },
        users_checked: allUsers.length,
        recommendations_outdated: recommendationsOutdatedResult,
        unactivated_emails_result: unactivatedEmailsResult,
      };

      // Send report email if requested
      if (send_report) {
        const currentDate = new Date().toISOString().split("T")[0];
        const environment = process.env.NODE_ENV || "development";
        const reportEmail = process.env.ADMIN_EMAIL || "admin@tracking.so";

        await sesService.sendEmail({
          to: reportEmail,
          subject: `Daily Job for Tracking.so [${environment}] [${currentDate}]`,
          htmlBody: `<strong>Daily Job Report in ${environment} environment</strong><br><br><pre>${JSON.stringify(result, null, 2)}</pre>`,
        });
      }

      res.json(result);
    } catch (error) {
      logger.error("Error in daily job:", error);
      res.status(500).json({ error: "Failed to run daily job" });
    }
  }
);

// Compute recommendations for a specific user
router.post(
  "/compute-recommendations",
  adminAuth,
  async (req: AdminRequest, res: Response): Promise<Response | void> => {
    try {
      const { username } = req.body;

      if (!username) {
        return res.status(400).json({ error: "username is required" });
      }

      // Get user by username
      const user = await prisma.user.findUnique({
        where: { username },
      });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Update user embedding
      await userService.updateUserEmbedding(user);

      // Compute recommendations
      const recommendations =
        await recommendationsService.computeRecommendedUsers(user.id);

      res.json({
        message: `Recommendations computed successfully for user ${username}`,
        user_id: user.id,
        recommendations,
      });
    } catch (error) {
      logger.error("Error computing recommendations:", error);
      res.status(500).json({ error: "Failed to compute recommendations" });
    }
  }
);

// Get recommendations for a specific user
router.get(
  "/get-recommendations/:username",
  adminAuth,
  async (req: AdminRequest, res: Response): Promise<Response | void> => {
    try {
      const { username } = req.params;

      if (!username) {
        return res.status(400).json({ error: "username is required" });
      }

      // Get user by username
      const user = await prisma.user.findUnique({
        where: { username },
      });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Get recommendations
      const recommendations = await recommendationsService.getRecommendedUsers(
        user.id
      );

      res.json({
        user: {
          id: user.id,
          username: user.username,
        },
        ...recommendations,
      });
    } catch (error) {
      logger.error("Error getting recommendations:", error);
      res.status(500).json({ error: "Failed to get recommendations" });
    }
  }
);

export const adminRouter: Router = router;
export default adminRouter;
