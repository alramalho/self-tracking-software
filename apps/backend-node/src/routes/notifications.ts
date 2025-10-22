import { Request, Response, Router } from "express";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth";
import { memoryService } from "../services/memoryService";
import { notificationService } from "../services/notificationService";
import { logger } from "../utils/logger";
import { prisma } from "../utils/prisma";
import { MessageRole } from "@tsw/prisma";
import { chatService } from "@/services/chatService";

const router = Router();

// Process scheduled notification
router.post(
  "/process-scheduled-notification",
  async (req: Request, res: Response): Promise<Response | void> => {
    try {
      const { notification_id } = req.body;

      if (!notification_id) {
        return res.status(400).json({ error: "Notification ID is required" });
      }

      logger.info(`Processing scheduled notification ${notification_id}`);

      // Get the notification
      const notification = await prisma.notification.findUnique({
        where: { id: notification_id },
        include: { user: true },
      });

      if (!notification) {
        return res.status(404).json({ error: "Notification not found" });
      }

      // Update notification status to processed and set processedAt
      const processedNotification = await prisma.notification.update({
        where: { id: notification_id },
        data: {
          status: "PROCESSED",
          processedAt: new Date(),
        },
      });

      // Send push notification if user has PWA notifications enabled
      if (
        notification.user.isPwaNotificationsEnabled &&
        notification.user.pwaSubscriptionEndpoint
      ) {
        try {
          await notificationService.sendPushNotification(
            notification.user.id,
            `hey ${notification.user.name || notification.user.username}`,
            processedNotification.message.toLowerCase(),
            `/add?notification_id=${processedNotification.id}`
          );
          logger.info(`Sent push notification to ${notification.user.id}`);
        } catch (pushError) {
          logger.error("Failed to send push notification:", pushError);
          throw pushError;
        }
      }

      const { chat } = await chatService.ensureNotificationsCoachExists(
        notification.userId
      );

      // Store message in conversation memory
      await memoryService.writeMessage({
        content: processedNotification.message,
        chatId: chat.id,
        role: MessageRole.COACH,
      });

      res.json({ message: "Notification processed and sent successfully" });
    } catch (error) {
      logger.error("Error processing scheduled notification:", error);
      res.status(500).json({ error: "Failed to process notification" });
    }
  }
);

// Mark notification as opened (legacy single notification endpoint)
router.post(
  "/mark-notification-opened",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const { notification_id } = req.query;

      if (!notification_id) {
        return res.status(400).json({ error: "notification_id is required" });
      }

      const notification = await prisma.notification.findUnique({
        where: { id: notification_id as string },
      });

      if (!notification) {
        return res.status(404).json({ error: "Notification not found" });
      }

      if (notification.userId !== req.user!.id) {
        return res.status(403).json({
          error: "Not authorized to mark this notification as opened",
        });
      }

      const updatedNotification = await prisma.notification.update({
        where: { id: notification_id as string },
        data: {
          status: "OPENED",
          openedAt: new Date(),
        },
      });

      logger.info(`Marked notification ${notification_id} as opened`);
      res.json({
        message: "Notification marked as opened",
        notification: updatedNotification,
      });
    } catch (error) {
      logger.error("Error marking notification as opened:", error);
      res.status(500).json({ error: "Failed to mark notification as opened" });
    }
  }
);

// Mark multiple notifications as opened (batch endpoint)
router.post(
  "/mark-notifications-opened",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const { notification_ids } = req.body;

      if (!notification_ids || !Array.isArray(notification_ids)) {
        return res
          .status(400)
          .json({ error: "notification_ids array is required" });
      }

      if (notification_ids.length === 0) {
        return res.json({
          message: "No notifications to mark as opened",
          count: 0,
        });
      }

      // Verify all notifications belong to the authenticated user
      const notifications = await prisma.notification.findMany({
        where: {
          id: { in: notification_ids },
        },
        select: { id: true, userId: true },
      });

      // Check if any notifications don't belong to the user
      const unauthorizedNotifications = notifications.filter(
        (n) => n.userId !== req.user!.id
      );

      if (unauthorizedNotifications.length > 0) {
        return res.status(403).json({
          error: "Not authorized to mark some notifications as opened",
        });
      }

      // Only update notifications that actually exist and belong to the user
      const validNotificationIds = notifications.map((n) => n.id);

      if (validNotificationIds.length === 0) {
        return res.status(404).json({ error: "No valid notifications found" });
      }

      // Batch update all valid notifications
      const result = await prisma.notification.updateMany({
        where: {
          id: { in: validNotificationIds },
          userId: req.user!.id,
        },
        data: {
          status: "OPENED",
          openedAt: new Date(),
        },
      });

      logger.info(
        `Marked ${result.count} notifications as opened for user ${req.user!.id}`
      );
      res.json({
        message: "Notifications marked as opened",
        count: result.count,
      });
    } catch (error) {
      logger.error("Error marking notifications as opened:", error);
      res.status(500).json({ error: "Failed to mark notifications as opened" });
    }
  }
);

router.get(
  "/",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const notifications = await prisma.notification.findMany({
        where: {
          userId: req.user!.id,
        },
        orderBy: {
          createdAt: "desc",
        },
      });
      return res.json(notifications);
    } catch (error) {
      logger.error("Error loading notifications:", error);
      res.status(500).json({ error: "Failed to load notifications" });
    }
  }
);

router.post(
  "/conclude/:notificationId",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const { notificationId } = req.params;

      const notification = await prisma.notification.findUnique({
        where: { id: notificationId },
      });

      if (!notification || notification.userId !== req.user!.id) {
        return res.status(404).json({ error: "Notification not found" });
      }

      const concludedNotification = await prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: "CONCLUDED",
          concludedAt: new Date(),
        },
      });

      logger.info(`Concluded notification ${notificationId}`);
      res.json({
        message: "Notification concluded",
        notification_id: concludedNotification.id,
      });
    } catch (error) {
      logger.error("Error concluding notification:", error);
      res.status(500).json({ error: "Failed to conclude notification" });
    }
  }
);

// Trigger push notification (for testing)
router.post(
  "/trigger-push-notification",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { title, body, url, icon, isNative } = req.body;

      const result = await notificationService.sendPushNotification(
        req.user!.id,
        title,
        body,
        url,
        icon
      );

      res.json(result);
    } catch (error) {
      logger.error("Error triggering push notification:", error);
      res.status(500).json({ error: "Failed to send push notification" });
    }
  }
);

// Clear all notifications except latest engagement
router.post(
  "/clear-all-notifications",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      // Get all non-concluded notifications
      const notifications = await prisma.notification.findMany({
        where: {
          userId: req.user!.id,
          status: { not: "CONCLUDED" },
        },
        orderBy: { createdAt: "desc" },
      });

      // Find the latest engagement notification
      const engagementNotifications = notifications.filter(
        (n) => n.type === "ENGAGEMENT"
      );
      const latestEngagement =
        engagementNotifications.length > 0 ? engagementNotifications[0] : null;

      // Conclude all notifications except the latest engagement and action-required notifications
      const notificationsToClose = notifications.filter(
        (n) =>
          n.id !== latestEngagement?.id &&
          n.type !== "FRIEND_REQUEST" &&
          n.type !== "PLAN_INVITATION"
      );

      if (notificationsToClose.length > 0) {
        await prisma.notification.updateMany({
          where: {
            id: { in: notificationsToClose.map((n) => n.id) },
          },
          data: {
            status: "CONCLUDED",
            concludedAt: new Date(),
          },
        });
      }

      logger.info(
        `Cleared ${notificationsToClose.length} notifications for user ${req.user!.id}`
      );
      res.json({
        message:
          "All notifications cleared except action-required notifications",
      });
    } catch (error) {
      logger.error("Error clearing notifications:", error);
      res.status(500).json({ error: "Failed to clear notifications" });
    }
  }
);

// Get PWA subscription
router.get(
  "/get-pwa-subscription",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { pwaSubscriptionEndpoint: true },
      });

      res.json({ stored_endpoint: user?.pwaSubscriptionEndpoint || null });
    } catch (error) {
      logger.error("Error getting PWA subscription:", error);
      res.status(500).json({ error: "Failed to get PWA subscription" });
    }
  }
);

// Create and immediately process notification
router.post(
  "/create-and-process-notification",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const {
        message,
        type,
        relatedId,
        relatedData,
        promptTag,
        pushNotify = true,
      } = req.body;

      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      const notification =
        await notificationService.createAndProcessNotification(
          {
            userId: req.user!.id,
            message,
            type: type || "INFO",
            relatedId,
            relatedData,
            promptTag,
          },
          pushNotify
        );

      logger.info(
        `Created and processed notification for user ${req.user!.id}`
      );
      res.json({
        message: "Notification created and processed successfully",
        notification,
      });
    } catch (error) {
      logger.error("Error creating and processing notification:", error);
      res
        .status(500)
        .json({ error: "Failed to create and process notification" });
    }
  }
);

// Get latest notification sent to user (optionally filtered by type)
router.get(
  "/latest-sent",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { type } = req.query;

      const notification =
        await notificationService.getLatestNotificationSentToUser(
          req.user!.id,
          type as any
        );

      res.json({ notification });
    } catch (error) {
      logger.error("Error getting latest sent notification:", error);
      res.status(500).json({ error: "Failed to get latest sent notification" });
    }
  }
);

export const notificationsRouter: Router = router;
export default notificationsRouter;
