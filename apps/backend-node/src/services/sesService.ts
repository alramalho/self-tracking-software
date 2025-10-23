import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { logger } from "../utils/logger";

export interface EmailData {
  to: string | string[];
  subject: string;
  htmlBody: string;
  textBody?: string;
  from?: string;
}

export interface BulkEmailData {
  to: string[];
  subject: string;
  htmlBody: string;
  textBody?: string;
  from?: string;
}

export class SESService {
  private sesClient: SESClient;
  private defaultFromEmail: string;

  constructor() {
    this.sesClient = new SESClient({
      region:
        process.env.AWS_SES_REGION || process.env.AWS_REGION || "eu-west-1",
      credentials: {
        accessKeyId: process.env.CUSTOM_AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.CUSTOM_AWS_SECRET_ACCESS_KEY || "",
      },
    });
    this.defaultFromEmail = process.env.ADMIN_EMAIL || "alex@tracking.so";
  }

  async sendEmail(data: EmailData): Promise<string> {
    try {
      const recipients = Array.isArray(data.to) ? data.to : [data.to];

      const command = new SendEmailCommand({
        Source: data.from || this.defaultFromEmail,
        Destination: {
          ToAddresses: recipients,
        },
        Message: {
          Subject: {
            Data: data.subject,
            Charset: "UTF-8",
          },
          Body: {
            Html: {
              Data: data.htmlBody,
              Charset: "UTF-8",
            },
            ...(data.textBody && {
              Text: {
                Data: data.textBody,
                Charset: "UTF-8",
              },
            }),
          },
        },
      });

      const result = await this.sesClient.send(command);
      logger.info(
        `Successfully sent email to ${recipients.join(", ")} with MessageId: ${result.MessageId}`
      );

      return result.MessageId || "unknown";
    } catch (error) {
      logger.error("Failed to send email via SES:", error);
      throw new Error(`SES email send failed: ${error}`);
    }
  }

  async sendBulkEmail(emails: EmailData[]): Promise<string[]> {
    const messageIds: string[] = [];

    for (const email of emails) {
      try {
        const messageId = await this.sendEmail(email);
        messageIds.push(messageId);
      } catch (error) {
        logger.error(`Failed to send bulk email to ${email.to}:`, error);
        // Continue with other emails even if one fails
        messageIds.push("failed");
      }
    }

    logger.info(
      `Sent ${emails.length} bulk emails, ${messageIds.filter((id) => id !== "failed").length} successful`
    );
    return messageIds;
  }

  async sendTemplatedEmail(
    to: string[],
    _templateName: string,
    templateData: any,
    from?: string
  ): Promise<string[]> {
    try {
      // For templated emails, we'll need to create the template first in AWS SES
      // For now, implement a basic version that sends individual emails
      const emails: EmailData[] = to.map((recipient) => ({
        to: recipient,
        subject: templateData.subject || "No Subject",
        htmlBody: this.processTemplate(templateData),
        from: from || this.defaultFromEmail,
      }));

      return await this.sendBulkEmail(emails);
    } catch (error) {
      logger.error("Failed to send templated email:", error);
      throw new Error(`SES templated email failed: ${error}`);
    }
  }

  private processTemplate(templateData: any): string {
    // Simple template processing - replace {{variable}} with data
    let html = templateData.html || "<p>{{message}}</p>";

    Object.keys(templateData).forEach((key) => {
      const regex = new RegExp(`{{${key}}}`, "g");
      html = html.replace(regex, templateData[key] || "");
    });

    return html;
  }

  async verifyEmailAddress(email: string): Promise<void> {
    try {
      // In production, you might want to implement email verification
      // For now, just log the intent
      logger.info(`Would verify email address: ${email}`);
    } catch (error) {
      logger.error("Failed to verify email address:", error);
      throw error;
    }
  }
}

export const sesService = new SESService();
