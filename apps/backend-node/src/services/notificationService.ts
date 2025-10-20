import { Notification, NotificationType } from "@tsw/prisma";
import { logger } from "../utils/logger";
import { prisma } from "../utils/prisma";

import * as webpush from "web-push";
import { apnsService } from "./apnsService";

export interface CreateNotificationData {
  userId: string;
  title?: string;
  message: string;
  type?: NotificationType;
  relatedId?: string;
  relatedData?: any;
  promptTag?: string;
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  url?: string;
  badge?: number;
}

export class NotificationService {
  private vapidPrivateKey: string;
  private vapidPublicKey: string;

  constructor() {
    this.vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || "";
    this.vapidPublicKey = process.env.VAPID_PUBLIC_KEY || "";

    // Configure web-push
    if (this.vapidPrivateKey && this.vapidPublicKey) {
      webpush.setVapidDetails(
        "mailto:alexandre.ramalho.1998@gmail.com",
        this.vapidPublicKey,
        this.vapidPrivateKey
      );
    }
  }

  async deleteNotification(notificationId: string): Promise<void> {
    const notification = await this.getNotification(notificationId);
    if (!notification) {
      logger.error(`Notification ${notificationId} not found`);
      throw new Error(`Notification ${notificationId} not found`);
    }

    // Delete notification from database
    await prisma.notification.delete({
      where: { id: notificationId },
    });

    logger.info(`Deleted notification ${notificationId}`);
  }

  async createNotification(
    data: CreateNotificationData
  ): Promise<Notification> {
    const notification = await prisma.notification.create({
      data: {
        userId: data.userId,
        title: data.title,
        message: data.message,
        type: data.type || "INFO",
        relatedId: data.relatedId,
        relatedData: data.relatedData,
        promptTag: data.promptTag,
        status: "PENDING",
      },
    });

    logger.info(`Created notification ${notification.id}`);
    return notification;
  }

  async processNotification(
    notificationId: string,
    pushNotify: boolean = true
  ): Promise<Notification | null> {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
      include: { user: true },
    });

    if (!notification || notification.status !== "PENDING") {
      return null;
    }

    // Update notification status
    const processedNotification = await prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: "PROCESSED",
        processedAt: new Date(),
      },
    });

    const user = notification.user;
    const title = notification.title || `hey ${user.name || user.username} 👋`;
    const body = processedNotification.message.toLowerCase();

    let isPush = false;
    if (user.pwaSubscriptionEndpoint && pushNotify) {
      try {
        await this.sendPushNotification(user.id, title, body);
        await prisma.notification.update({
          where: { id: notificationId },
          data: { sentAt: new Date() },
        });
        isPush = true;
      } catch (error) {
        logger.error("Error sending push notification:", error);
      }
    }

    // TODO: Add PostHog analytics when implemented
    if (processedNotification.type === "COACH") {
      logger.info(
        `Coach notification sent to user ${user.id}, isPush: ${isPush}`
      );
    }

    logger.info(`Notification '${notificationId}' processed`);
    return processedNotification;
  }

  async createAndProcessNotification(
    data: CreateNotificationData,
    pushNotify: boolean = true
  ): Promise<Notification | null> {
    const notification = await this.createNotification(data);
    return await this.processNotification(notification.id, pushNotify);
  }

  async markNotificationAsOpened(
    notificationId: string
  ): Promise<Notification | null> {
    const notification = await this.getNotification(notificationId);
    if (notification && notification.status === "PROCESSED") {
      const updatedNotification = await prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: "OPENED",
          openedAt: new Date(),
        },
      });

      logger.info(`Notification '${notificationId}' marked as opened`);
      return updatedNotification;
    }
    return null;
  }

  async markNotificationAsConcluded(
    notificationId: string
  ): Promise<Notification | null> {
    const notification = await this.getNotification(notificationId);
    if (notification) {
      if (notification.status === "CONCLUDED") {
        logger.info(`Notification '${notificationId}' already concluded`);
        return notification;
      }

      const updatedNotification = await prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: "CONCLUDED",
          concludedAt: new Date(),
        },
      });

      logger.info(`Notification '${notificationId}' marked as concluded`);
      return updatedNotification;
    }
    return null;
  }

  async getNotification(notificationId: string): Promise<Notification | null> {
    return prisma.notification.findUnique({
      where: { id: notificationId },
    });
  }

  async getAllForUser(userId: string): Promise<Notification[]> {
    return prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });
  }

  async getAllNonConcludedForUser(userId: string): Promise<Notification[]> {
    return prisma.notification.findMany({
      where: {
        userId,
        status: { not: "CONCLUDED" },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async getLatestNotificationSentToUser(
    userId: string,
    type?: NotificationType
  ): Promise<Notification | null> {
    const whereClause: any = {
      userId,
      sentAt: { not: null },
    };

    if (type) {
      whereClause.type = type;
    }

    return prisma.notification.findFirst({
      where: whereClause,
      orderBy: { sentAt: "desc" },
    });
  }

  async getUserNotifications(
    userId: string,
    limit: number = 50
  ): Promise<Notification[]> {
    return prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  /**
   * Send a push notification to a user
   * Automatically detects platform (iOS native vs Web/PWA) and routes accordingly
   */
  async sendPushNotification(
    userId: string,
    title: string,
    body: string,
    url?: string,
    icon?: string
  ): Promise<{ message: string; platform: "ios" | "web" | "none" }> {
    const environment =
      process.env.ENVIRONMENT || process.env.NODE_ENV || "development";

    if (environment === "dev" || environment === "development") {
      logger.warn(
        `Skipping push notification for '${userId}' in '${environment}' environment`
      );
      return {
        message: "Push notification skipped in development",
        platform: "none",
      };
    }

    // Fetch user with all notification-related fields
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        isIosNotificationsEnabled: true,
        iosDeviceToken: true,
        isPwaNotificationsEnabled: true,
        pwaSubscriptionEndpoint: true,
        pwaSubscriptionKey: true,
        pwaSubscriptionAuthToken: true,
      },
    });

    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    const badge = await this.getNonConcludedNotificationsCount(userId);

    // Priority 1: Try iOS native push if enabled and configured
    if (
      user.isIosNotificationsEnabled &&
      user.iosDeviceToken &&
      apnsService.isConfigured()
    ) {
      try {
        await apnsService.sendPushNotification({
          deviceToken: user.iosDeviceToken,
          title,
          body,
          badge,
          data: { url },
        });

        logger.info(`iOS push notification sent to user ${userId}`);
        return {
          message: "iOS push notification sent successfully",
          platform: "ios",
        };
      } catch (error: any) {
        logger.error(
          `Failed to send iOS push notification to ${userId}:`,
          error
        );

        // If device token is invalid, clear it from the database
        if (
          error.message?.includes("invalid") ||
          error.message?.includes("expired")
        ) {
          await prisma.user.update({
            where: { id: userId },
            data: {
              iosDeviceToken: null,
              iosDeviceTokenUpdatedAt: null,
              isIosNotificationsEnabled: false,
            },
          });
          logger.info(`Cleared invalid iOS device token for user ${userId}`);
        }

        // Fall through to try web push
        logger.info(`Falling back to web push for user ${userId}`);
      }
    }

    // Priority 2: Try web push if enabled and configured
    if (
      user.isPwaNotificationsEnabled &&
      user.pwaSubscriptionEndpoint &&
      user.pwaSubscriptionKey &&
      user.pwaSubscriptionAuthToken
    ) {
      const subscriptionInfo = {
        endpoint: user.pwaSubscriptionEndpoint,
        keys: {
          p256dh: user.pwaSubscriptionKey,
          auth: user.pwaSubscriptionAuthToken,
        },
      };

      const payload: PushNotificationPayload = {
        title,
        body,
        icon,
        url,
        badge,
      };

      logger.info(
        `Sending web push notification to: ${subscriptionInfo.endpoint}`
      );

      try {
        const response = await webpush.sendNotification(
          subscriptionInfo,
          JSON.stringify(payload),
          {
            vapidDetails: {
              subject: "mailto:alexandre.ramalho.1998@gmail.com",
              publicKey: this.vapidPublicKey,
              privateKey: this.vapidPrivateKey,
            },
          }
        );

        logger.info(
          `Web push notification sent to user ${userId}, status: ${response.statusCode}`
        );
        return {
          message: "Web push notification sent successfully",
          platform: "web",
        };
      } catch (error: any) {
        logger.error("WebPush error:", error);

        // Handle specific web-push errors
        if (error.statusCode === 410) {
          logger.warn(
            `Subscription expired for user ${userId}, clearing subscription`
          );
          await prisma.user.update({
            where: { id: userId },
            data: {
              pwaSubscriptionEndpoint: null,
              pwaSubscriptionKey: null,
              pwaSubscriptionAuthToken: null,
              isPwaNotificationsEnabled: false,
            },
          });
        } else if (error.statusCode === 413) {
          logger.error(`Payload too large for user ${userId}`);
        } else if (error.statusCode === 429) {
          logger.warn(`Rate limited for user ${userId}`);
        }

        throw error;
      }
    }

    // No valid notification method found
    logger.warn(`No valid push notification method for user ${userId}`);
    throw new Error(
      `No valid notification subscription found for user ${userId}. ` +
        `User needs to enable either iOS or web push notifications.`
    );
  }

  async getNonConcludedNotificationsCount(userId: string): Promise<number> {
    return prisma.notification.count({
      where: {
        userId,
        status: { not: "CONCLUDED" },
      },
    });
  }

  async sendTestPushNotification(userId: string): Promise<void> {
    await this.createAndProcessNotification({
      userId,
      message: "This is a test notification",
      type: "INFO",
    });
  }
}

export const notificationService = new NotificationService();
