import axios from 'axios';
import { logger } from '../utils/logger';

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
  private chatId: string;

  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || '';
    this.chatId = process.env.TELEGRAM_CHAT_ID || '';
  }

  async sendErrorNotification(data: ErrorNotificationData): Promise<void> {
    if (!this.botToken || !this.chatId) {
      logger.warn('Telegram bot token or chat ID not configured');
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

    try {
      await axios.post(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
        chat_id: this.chatId,
        text: message,
        parse_mode: 'Markdown',
      });
    } catch (error) {
      logger.error('Failed to send Telegram notification:', error);
    }
  }

  async sendMessage(message: string): Promise<void> {
    if (!this.botToken || !this.chatId) {
      logger.warn('Telegram bot token or chat ID not configured');
      return;
    }

    try {
      await axios.post(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
        chat_id: this.chatId,
        text: message,
      });
    } catch (error) {
      logger.error('Failed to send Telegram message:', error);
    }
  }
}