import axios from "axios";
import { logger } from "../utils/logger";
import type {
  TelegramChannel,
  TelegramConnectionReport,
  TelegramDeliveryReport,
  TelegramDestinationCheck,
  TelegramErrorNotificationData,
} from "./telegram/types";

const TELEGRAM_API_TIMEOUT_MS = 6000;

function firstConfiguredValue(...values: Array<string | undefined>): string {
  return values.find((value) => value?.trim())?.trim() ?? "";
}

function parseChatIds(value: string): string[] {
  return [
    ...new Set(
      value
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ];
}

function maskedChatId(chatId: string): string {
  return `…${chatId.slice(-4)}`;
}

function isTelegramFormattingError(error: unknown): boolean {
  if (!axios.isAxiosError(error) || error.response?.status !== 400) {
    return false;
  }

  const description = String(error.response.data?.description ?? "");
  return description.toLowerCase().includes("can't parse entities");
}

export class TelegramService {
  private botToken: string;
  private chatIds: string[];
  private alertChatIds: string[];
  private hasDedicatedAlerts: boolean;
  private appName: string;

  constructor(environment: NodeJS.ProcessEnv = process.env) {
    this.botToken = environment.TELEGRAM_BOT_TOKEN?.trim() ?? "";
    this.appName = environment.TELEGRAM_APP_NAME?.trim() || "tracking.so";
    this.chatIds = parseChatIds(
      firstConfiguredValue(
        environment.TELEGRAM_CHAT_IDS,
        environment.TELEGRAM_CHAT_ID,
      ),
    );

    const dedicatedAlertChatIds = parseChatIds(
      firstConfiguredValue(
        environment.TELEGRAM_ALERT_CHAT_IDS,
        environment.TELEGRAM_ALERT_CHAT_ID,
      ),
    );
    this.hasDedicatedAlerts = dedicatedAlertChatIds.length > 0;
    this.alertChatIds = this.hasDedicatedAlerts
      ? dedicatedAlertChatIds
      : this.chatIds;
  }

  async sendErrorNotification(
    data: TelegramErrorNotificationData,
  ): Promise<TelegramDeliveryReport> {
    let message = `🚨 *Error on user ${data.userUsername || data.userId || "unknown"}*\n${data.errorMessage}`;

    if (data.method || data.path) {
      let endpoint = "*Endpoint:*";
      if (data.method) {
        endpoint += ` ${data.method}`;
      }
      if (data.path) {
        endpoint += ` ${data.path}`;
      }
      message += `\n${endpoint}`;
    }

    return this.sendToChannel(this.alertMessage(message), "alerts", "Markdown");
  }

  async sendMessage(message: string): Promise<TelegramDeliveryReport> {
    return this.sendToChannel(message, "activity", "Markdown");
  }

  async sendAlert(message: string): Promise<TelegramDeliveryReport> {
    return this.sendToChannel(
      this.alertMessage(message),
      "alerts",
      "Markdown",
    );
  }

  async sendPlainMessage(message: string): Promise<TelegramDeliveryReport> {
    return this.sendToChannel(message, "activity");
  }

  async sendMessageWithPhotos(
    message: string,
    photoUrls: string[],
  ): Promise<TelegramDeliveryReport> {
    return this.sendToChannelWithPhotos(message, photoUrls, "activity");
  }

  async sendAlertWithPhotos(
    message: string,
    photoUrls: string[],
  ): Promise<TelegramDeliveryReport> {
    return this.sendToChannelWithPhotos(
      this.alertMessage(message),
      photoUrls,
      "alerts",
    );
  }

  async checkConnection(
    channel: TelegramChannel,
  ): Promise<TelegramConnectionReport> {
    const chatIds = this.chatIdsFor(channel);
    const report: TelegramConnectionReport = {
      channel,
      dedicated: channel === "activity" || this.hasDedicatedAlerts,
      botConfigured: Boolean(this.botToken),
      botOk: false,
      destinations: [],
    };

    if (!this.botToken) {
      return report;
    }

    try {
      const botResponse = await axios.get(
        `https://api.telegram.org/bot${this.botToken}/getMe`,
        { timeout: TELEGRAM_API_TIMEOUT_MS },
      );
      report.botOk = botResponse.data?.ok === true;
      report.botUsername = botResponse.data?.result?.username;
    } catch (error) {
      logger.error("Failed to verify Telegram bot identity", error);
      return report;
    }

    report.destinations = await Promise.all(
      chatIds.map((chatId) => this.checkDestination(chatId)),
    );
    return report;
  }

  private async sendToChannelWithPhotos(
    message: string,
    photoUrls: string[],
    channel: TelegramChannel,
  ): Promise<TelegramDeliveryReport> {
    const chatIds = this.chatIdsFor(channel);
    const unconfiguredReport = this.unconfiguredReport(channel, chatIds);
    if (unconfiguredReport) {
      return unconfiguredReport;
    }

    const results = await Promise.allSettled(
      chatIds.map(async (chatId) => {
        try {
          await this.sendTextToChat(chatId, message, "Markdown");

          for (const photoUrl of photoUrls) {
            await axios.post(
              `https://api.telegram.org/bot${this.botToken}/sendPhoto`,
              {
                chat_id: chatId,
                photo: photoUrl,
              },
              { timeout: TELEGRAM_API_TIMEOUT_MS },
            );
          }

          logger.debug(
            `Telegram ${channel} message with ${photoUrls.length} photo(s) delivered to ${maskedChatId(chatId)}`,
          );
        } catch (error) {
          logger.error(
            `Failed to deliver Telegram ${channel} message with photos to ${maskedChatId(chatId)}`,
            error,
          );
          throw error;
        }
      }),
    );

    return this.deliveryReport(channel, results);
  }

  private async sendToChannel(
    message: string,
    channel: TelegramChannel,
    parseMode?: string,
  ): Promise<TelegramDeliveryReport> {
    const chatIds = this.chatIdsFor(channel);
    const unconfiguredReport = this.unconfiguredReport(channel, chatIds);
    if (unconfiguredReport) {
      return unconfiguredReport;
    }

    const results = await Promise.allSettled(
      chatIds.map(async (chatId) => {
        try {
          await this.sendTextToChat(chatId, message, parseMode);
          logger.debug(
            `Telegram ${channel} message delivered to ${maskedChatId(chatId)}`,
          );
        } catch (error) {
          logger.error(
            `Failed to deliver Telegram ${channel} message to ${maskedChatId(chatId)}`,
            error,
          );
          throw error;
        }
      }),
    );

    return this.deliveryReport(channel, results);
  }

  private async sendTextToChat(
    chatId: string,
    message: string,
    parseMode?: string,
  ): Promise<void> {
    const payload: Record<string, string> = {
      chat_id: chatId,
      text: message,
    };

    if (parseMode) {
      payload.parse_mode = parseMode;
    }

    try {
      await axios.post(
        `https://api.telegram.org/bot${this.botToken}/sendMessage`,
        payload,
        { timeout: TELEGRAM_API_TIMEOUT_MS },
      );
    } catch (error) {
      if (!parseMode || !isTelegramFormattingError(error)) {
        throw error;
      }

      logger.warn(
        `Telegram formatting rejected for ${maskedChatId(chatId)}; retrying as plain text`,
      );
      await axios.post(
        `https://api.telegram.org/bot${this.botToken}/sendMessage`,
        { chat_id: chatId, text: message },
        { timeout: TELEGRAM_API_TIMEOUT_MS },
      );
    }
  }

  private async checkDestination(
    chatId: string,
  ): Promise<TelegramDestinationCheck> {
    try {
      const response = await axios.post(
        `https://api.telegram.org/bot${this.botToken}/getChat`,
        { chat_id: chatId },
        { timeout: TELEGRAM_API_TIMEOUT_MS },
      );
      const chat = response.data?.result;
      return {
        maskedChatId: maskedChatId(chatId),
        ok: response.data?.ok === true,
        type: chat?.type,
        title:
          chat?.title ??
          chat?.username ??
          [chat?.first_name, chat?.last_name].filter(Boolean).join(" "),
      };
    } catch (error) {
      return {
        maskedChatId: maskedChatId(chatId),
        ok: false,
        error: axios.isAxiosError(error)
          ? String(error.response?.data?.description ?? error.message)
          : String(error),
      };
    }
  }

  private chatIdsFor(channel: TelegramChannel): string[] {
    return channel === "alerts" ? this.alertChatIds : this.chatIds;
  }

  private alertMessage(message: string): string {
    return `📱 *${this.appName}*\n${message}`;
  }

  private unconfiguredReport(
    channel: TelegramChannel,
    chatIds: string[],
  ): TelegramDeliveryReport | null {
    if (this.botToken && chatIds.length > 0) {
      return null;
    }

    logger.warn(`Telegram ${channel} destination is not configured`);
    return {
      channel,
      configured: false,
      attempted: 0,
      delivered: 0,
      failed: 0,
    };
  }

  private deliveryReport(
    channel: TelegramChannel,
    results: PromiseSettledResult<void>[],
  ): TelegramDeliveryReport {
    const delivered = results.filter(
      (result) => result.status === "fulfilled",
    ).length;
    return {
      channel,
      configured: true,
      attempted: results.length,
      delivered,
      failed: results.length - delivered,
    };
  }
}
