import axios from "axios";
import { logger } from "../utils/logger";

interface ErrorNotificationData {
  errorMessage: string;
  userUsername: string;
  userId: string;
  path: string;
  method: string;
  statusCode: string;
}

export class TelegramService {
  private botToken: string;
  private chatIds: string[];

  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || "";
    const chatIdsString = process.env.TELEGRAM_CHAT_IDS || "";
    this.chatIds = chatIdsString
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0);
  }

  async sendErrorNotification(data: ErrorNotificationData): Promise<void> {
    if (!this.botToken || this.chatIds.length === 0) {
      logger.warn("Telegram bot token or chat IDs not configured");
      return;
    }

    const message = `
🚨 *Error Alert*

*Error:* ${data.errorMessage}
*User:* ${data.userUsername} (${data.userId})
*Endpoint:* ${data.method} ${data.path}
*Status Code:* ${data.statusCode}
*Time:* ${new Date().toISOString()}
    `.trim();

    await this.sendToAllChats(message, "Markdown");
  }

  async sendMessage(message: string): Promise<void> {
    if (!this.botToken || this.chatIds.length === 0) {
      logger.warn("Telegram bot token or chat IDs not configured");
      return;
    }

    await this.sendToAllChats(message);
  }

  private async sendToAllChats(
    message: string,
    parseMode?: string
  ): Promise<void> {
    const promises = this.chatIds.map(async (chatId) => {
      try {
        const payload: any = {
          chat_id: chatId,
          text: message,
        };

        if (parseMode) {
          payload.parse_mode = parseMode;
        }

        await axios.post(
          `https://api.telegram.org/bot${this.botToken}/sendMessage`,
          payload
        );
        logger.debug(`Message sent successfully to chat ID: ${chatId}`);
      } catch (error) {
        logger.error(
          `Failed to send Telegram message to chat ID ${chatId}:`,
          error
        );
      }
    });

    await Promise.allSettled(promises);
  }
}
