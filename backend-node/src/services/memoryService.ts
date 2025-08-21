import { logger } from "../utils/logger";
import { prisma } from "../utils/prisma";

export interface ConversationMessage {
  id: string;
  userId: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  createdAt: Date;
  emotions?: any[];
}

// note to self, we were amidst fixing bakcend docker build (local), then remotely
// and we were also amidst fixing vercel frontend build

export class MemoryService {
  async writeMessage(options: {
    content: string;
    userId: string;
    role: "USER" | "ASSISTANT" | "SYSTEM";
    emotions?: any[];
  }): Promise<ConversationMessage> {
    try {
      const savedMessage = await prisma.message.create({
        data: {
          userId: options.userId,
          role: options.role,
          content: options.content,
          emotions: options.emotions
            ? {
                create: options.emotions.map((emotion: any) => ({
                  name: emotion.name,
                  score: emotion.score,
                  color: emotion.color,
                })),
              }
            : undefined,
        },
        include: {
          emotions: true,
        },
      });

      return {
        id: savedMessage.id,
        userId: savedMessage.userId,
        role: savedMessage.role,
        content: savedMessage.content,
        createdAt: savedMessage.createdAt,
        emotions: savedMessage.emotions,
      };
    } catch (error) {
      logger.warn(
        "Could not save message, continuing without memory storage:",
        error
      );
      return {
        id: "temp-" + Date.now(),
        userId: options.userId,
        role: options.role,
        content: options.content,
        createdAt: new Date(),
        emotions: options.emotions || [],
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
          userId,
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

  async readAllAsString(
    userId: string,
    maxMessages: number = 4,
    maxAgeMinutes: number = 30
  ): Promise<string> {
    try {
      const messages = await prisma.message.findMany({
        where: {
          userId,
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

  async getLatestAIMessage(
    userId: string
  ): Promise<ConversationMessage | null> {
    try {
      const message = await prisma.message.findFirst({
        where: {
          userId,
          role: "ASSISTANT",
        },
        orderBy: {
          createdAt: "desc",
        },
        include: {
          emotions: true,
        },
      });

      if (!message) return null;

      return {
        id: message.id,
        userId: message.userId,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
        emotions: message.emotions,
      };
    } catch (error) {
      logger.warn("Could not get latest AI message:", error);
      return null;
    }
  }
}

export const memoryService = new MemoryService();
