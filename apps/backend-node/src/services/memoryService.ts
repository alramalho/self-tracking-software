import { Message, MessageRole } from "@tsw/prisma";
import { logger } from "../utils/logger";
import { prisma } from "../utils/prisma";
export class MemoryService {
  async writeMessage(options: {
    content: string;
    chatId: string;
    role: MessageRole;
    planId?: string;
    metadata?: any;
  }): Promise<Message> {
    try {
      const savedMessage = await prisma.message.create({
        data: {
          chatId: options.chatId,
          role: options.role,
          content: options.content,
          planId: options.planId,
          metadata: options.metadata,
        },
      });

      return {
        id: savedMessage.id,
        chatId: savedMessage.chatId,
        planId: savedMessage.planId,
        role: savedMessage.role,
        content: savedMessage.content,
        createdAt: savedMessage.createdAt,
        metadata: savedMessage.metadata,
      };
    } catch (error) {
      logger.warn(
        "Could not save message, continuing without memory storage:",
        error
      );
      return {
        id: "temp-" + Date.now(),
        chatId: options.chatId,
        role: options.role,
        content: options.content,
        createdAt: new Date(),
        planId: options.planId || null,
        metadata: null,
      };
    }
  }

  async readConversationHistory(
    userId: string,
    maxAgeMinutes: number = 30,
    maxMessages: number = 50
  ): Promise<string> {
    try {
      const messages = await prisma.message.findMany({
        where: {
          chat: { userId: userId },
          createdAt: {
            gte: new Date(Date.now() - maxAgeMinutes * 60 * 1000),
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: maxMessages,
        include: {
          emotions: true,
        },
      });

      // Format messages as conversation history
      return messages
        .reverse() // Show chronological order
        .map((msg: any) => `${msg.role}: ${msg.content}`)
        .join("\n");
    } catch (error) {
      logger.warn("Could not read conversation history:", error);
      return "";
    }
  }
}

export const memoryService = new MemoryService();
