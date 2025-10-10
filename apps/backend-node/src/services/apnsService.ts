import apn from "@parse/node-apn";
import fs from "fs";
import { logger } from "../utils/logger";

export interface ApnsPushPayload {
  deviceToken: string;
  title: string;
  body: string;
  badge?: number;
  sound?: string;
  data?: Record<string, any>;
}

export class ApnsService {
  private provider: apn.Provider | null = null;
  private isProduction: boolean;

  constructor() {
    this.isProduction = process.env.APNS_PRODUCTION === "true";
    this.initializeProvider();
  }

  private initializeProvider() {
    try {
      const keyPath = process.env.APNS_KEY_PATH;
      const keyId = process.env.APNS_KEY_ID;
      const teamId = process.env.APNS_TEAM_ID;

      if (!keyPath || !keyId || !teamId) {
        logger.warn(
          "APNs configuration incomplete. iOS push notifications will not work. " +
            "Required: APNS_KEY_PATH, APNS_KEY_ID, APNS_TEAM_ID"
        );
        return;
      }

      if (!fs.existsSync(keyPath)) {
        logger.warn(
          `APNs key file not found at ${keyPath}. iOS push notifications will not work.`
        );
        return;
      }

      // Token-based authentication (recommended by Apple)
      this.provider = new apn.Provider({
        token: {
          key: keyPath,
          keyId,
          teamId,
        },
        production: this.isProduction,
      });

      logger.info(
        `✅ APNs provider initialized (${this.isProduction ? "production" : "development"})`
      );
    } catch (error) {
      logger.error("Failed to initialize APNs provider:", error);
    }
  }

  isConfigured(): boolean {
    return this.provider !== null;
  }

  async sendPushNotification(
    params: ApnsPushPayload
  ): Promise<{ success: boolean; message: string }> {
    if (!this.provider) {
      throw new Error(
        "APNs provider not initialized. Check your configuration."
      );
    }

    const { deviceToken, title, body, badge, sound = "default", data } = params;

    const bundleId = process.env.APNS_BUNDLE_ID;
    if (!bundleId) {
      throw new Error("APNS_BUNDLE_ID not configured");
    }

    const notification = new apn.Notification({
      alert: {
        title,
        body,
      },
      badge,
      sound,
      topic: bundleId, // Required for token-based auth
      payload: data || {},
      contentAvailable: 1, // Wake the app in background
      mutableContent: 1, // Allow notification service extension to modify
    });

    try {
      logger.info(
        `Sending APNs notification to device: ${deviceToken.substring(0, 10)}...`
      );

      const result = await this.provider.send(notification, deviceToken);

      if (result.failed.length > 0) {
        const failure = result.failed[0];
        logger.error("APNs send failed:", {
          device: failure.device,
          status: failure.status,
          response: failure.response,
        });

        // Handle specific APNs errors
        if (failure.status === 410) {
          // Device token is no longer valid
          logger.warn(
            `Device token invalid/expired: ${deviceToken.substring(0, 10)}...`
          );
          throw new Error("Device token invalid or expired");
        }

        throw new Error(
          `Failed to send APNs notification: ${failure.response?.reason || "Unknown error"}`
        );
      }

      logger.info(
        `✅ APNs notification sent successfully to ${deviceToken.substring(0, 10)}...`
      );

      return {
        success: true,
        message: "iOS push notification sent successfully",
      };
    } catch (error: any) {
      logger.error("Error sending APNs notification:", error);
      throw error;
    }
  }

  async shutdown() {
    if (this.provider) {
      await this.provider.shutdown();
      logger.info("APNs provider shut down");
    }
  }
}

export const apnsService = new ApnsService();
