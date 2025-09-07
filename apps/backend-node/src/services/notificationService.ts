import { Notification, NotificationType } from "@tsw/prisma";
import { logger } from "../utils/logger";
import { prisma } from "../utils/prisma";

import * as webpush from "web-push";

export interface CreateNotificationData {
  userId: string;
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
    const title = `hey ${user.name || user.username} 👋`;
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

  async sendPushNotification(
    userId: string,
    title: string,
    body: string,
    url?: string,
    icon?: string
  ): Promise<{ message: string }> {
    const environment =
      process.env.ENVIRONMENT || process.env.NODE_ENV || "development";

    // if (environment === "dev" || environment === "development") {
    //   logger.warn(
    //     `Skipping push notification for '${userId}' in '${environment}' environment`
    //   );
    //   return { message: "Push notification skipped in development" };
    // }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        pwaSubscriptionEndpoint: true,
        pwaSubscriptionKey: true,
        pwaSubscriptionAuthToken: true,
      },
    });

    if (
      !user?.pwaSubscriptionEndpoint ||
      !user.pwaSubscriptionKey ||
      !user.pwaSubscriptionAuthToken
    ) {
      logger.error(`Subscription not found for ${userId}`);
      throw new Error(`Subscription not found for ${userId}`);
    }

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
      badge: await this.getNonConcludedNotificationsCount(userId),
    };

    logger.info(`Sending push notification to: ${subscriptionInfo.endpoint}`);
    logger.info(`Payload:`, payload);

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

      // TODO: Add PostHog analytics when implemented
      logger.info(`WebPush response status: ${response.statusCode}`);
      return { message: "Push notification sent successfully" };
    } catch (error: any) {
      logger.error("WebPush error:", error);

      // Handle specific web-push errors similar to Python's WebPushException
      if (error.statusCode === 410) {
        logger.warn(
          `Subscription expired for user ${userId}, should remove subscription`
        );
      } else if (error.statusCode === 413) {
        logger.error(`Payload too large for user ${userId}`);
      } else if (error.statusCode === 429) {
        logger.warn(`Rate limited for user ${userId}`);
      }

      throw error;
    }
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
