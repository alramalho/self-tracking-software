import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

export interface ConversationMessage {
  id: string;
  text: string;
  senderName: string;
  senderId: string;
  recipientName: string;
  recipientId: string;
  createdAt: Date;
  emotions?: any[];
}

export class MemoryService {
  
  async writeMessage(message: Omit<ConversationMessage, 'id' | 'createdAt'>): Promise<ConversationMessage> {
    try {
      const savedMessage = await prisma.message.create({
        data: {
          senderId: message.senderId,
          senderName: message.senderName,
          recipientId: message.recipientId,
          recipientName: message.recipientName,
          text: message.text,
          emotions: message.emotions ? {
            create: message.emotions.map((emotion: any) => ({
              name: emotion.name,
              score: emotion.score,
              color: emotion.color,
            }))
          } : undefined,
        },
        include: {
          emotions: true,
        },
      });

      return {
        id: savedMessage.id,
        text: savedMessage.text,
        senderName: savedMessage.senderName,
        senderId: savedMessage.senderId,
        recipientName: savedMessage.recipientName,
        recipientId: savedMessage.recipientId,
        createdAt: savedMessage.createdAt,
        emotions: savedMessage.emotions,
      };
    } catch (error) {
      logger.warn('Could not save message, continuing without memory storage:', error);
      return {
        id: 'temp-' + Date.now(),
        text: message.text,
        senderName: message.senderName,
        senderId: message.senderId,
        recipientName: message.recipientName,
        recipientId: message.recipientId,
        createdAt: new Date(),
        emotions: message.emotions || [],
      };
    }
  }

  async readConversationHistory(userId: string, maxAgeMinutes: number = 30, maxMessages: number = 50): Promise<string> {
    try {
      const messages = await prisma.message.findMany({
        where: {
          OR: [
            { senderId: userId },
            { recipientId: userId }
          ],
          createdAt: {
            gte: new Date(Date.now() - maxAgeMinutes * 60 * 1000)
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: maxMessages,
        include: {
          emotions: true
        }
      });

      // Format messages as conversation history
      return messages
        .reverse() // Show chronological order
        .map(msg => `${msg.senderName}: ${msg.text}`)
        .join('\n');
    } catch (error) {
      logger.warn('Could not read conversation history:', error);
      return '';
    }
  }

  async readAllAsString(userId: string, maxMessages: number = 4, maxAgeMinutes: number = 30): Promise<string> {
    try {
      const messages = await prisma.message.findMany({
        where: {
          OR: [
            { senderId: userId },
            { recipientId: userId }
          ],
          createdAt: {
            gte: new Date(Date.now() - maxAgeMinutes * 60 * 1000)
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: maxMessages,
        include: {
          emotions: true
        }
      });

      // Format messages as conversation history
      return messages
        .reverse() // Show chronological order
        .map(msg => `${msg.senderName}: ${msg.text}`)
        .join('\n');
    } catch (error) {
      logger.warn('Could not read conversation history:', error);
      return '';
    }
  }

  async getLatestAIMessage(userId: string): Promise<ConversationMessage | null> {
    try {
      const message = await prisma.message.findFirst({
        where: {
          OR: [
            { senderId: userId },
            { recipientId: userId }
          ],
          senderName: 'Jarvis'
        },
        orderBy: {
          createdAt: 'desc'
        },
        include: {
          emotions: true
        }
      });

      if (!message) return null;

      return {
        id: message.id,
        text: message.text,
        senderName: message.senderName,
        senderId: message.senderId,
        recipientName: message.recipientName,
        recipientId: message.recipientId,
        createdAt: message.createdAt,
        emotions: message.emotions,
      };
    } catch (error) {
      logger.warn('Could not get latest AI message:', error);
      return null;
    }
  }
}

export const memoryService = new MemoryService();