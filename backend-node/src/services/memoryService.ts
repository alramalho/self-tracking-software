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
  
  async writeMessage(userId: string, message: Omit<ConversationMessage, 'id' | 'createdAt'>): Promise<ConversationMessage> {
    try {
      // For now, we'll use a simple message storage in the database
      // This could be extended to use DynamoDB like the Python version
      const savedMessage = await prisma.$queryRaw`
        INSERT INTO conversation_messages (
          userId, text, sender_name, senderId, recipient_name, recipientId, emotions, createdAt
        ) VALUES (
          ${userId}, ${message.text}, ${message.senderName}, ${message.senderId}, 
          ${message.recipientName}, ${message.recipientId}, ${JSON.stringify(message.emotions || [])}, NOW()
        ) RETURNING *
      ` as any[];

      return savedMessage[0];
    } catch (error) {
      // If the table doesn't exist, we'll just log and continue without memory
      logger.warn('Conversation messages table not available, continuing without memory storage:', error);
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
      const messages = await prisma.$queryRaw`
        SELECT * FROM conversation_messages 
        WHERE userId = ${userId} 
        AND createdAt > NOW() - INTERVAL '${maxAgeMinutes} minutes'
        ORDER BY createdAt DESC 
        LIMIT ${maxMessages}
      ` as ConversationMessage[];

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
      const messages = await prisma.$queryRaw`
        SELECT * FROM conversation_messages 
        WHERE userId = ${userId} 
        AND createdAt > NOW() - INTERVAL '${maxAgeMinutes} minutes'
        ORDER BY createdAt DESC 
        LIMIT ${maxMessages}
      ` as ConversationMessage[];

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
      const messages = await prisma.$queryRaw`
        SELECT * FROM conversation_messages 
        WHERE userId = ${userId} 
        AND sender_name = 'Jarvis'
        ORDER BY createdAt DESC 
        LIMIT 1
      ` as ConversationMessage[];

      return messages[0] || null;
    } catch (error) {
      logger.warn('Could not get latest AI message:', error);
      return null;
    }
  }
}

export const memoryService = new MemoryService();