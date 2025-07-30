import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { prisma } from '../utils/prisma';

const router = Router();

// Move message up by updating its timestamp to now
router.post('/:messageId/move-up', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { messageId } = req.params;

    logger.info(`Moving up message ${messageId} for user ${req.user!.id}`);

    // For PostgreSQL with Prisma, we'll update the conversation_messages table
    // This endpoint appears to be for reordering conversation messages
    const updatedMessage = await prisma.$queryRaw`
      UPDATE conversation_messages 
      SET createdAt = NOW() 
      WHERE id = ${messageId} 
      AND userId = ${req.user!.id}
      RETURNING *
    ` as any[];

    if (updatedMessage.length === 0) {
      return res.status(404).json({ error: 'Message not found or access denied' });
    }

    const message = updatedMessage[0];
    
    logger.info(`Successfully moved up message ${messageId}`);

    res.json({
      id: message.id,
      text: message.text,
      senderName: message.sender_name,
      senderId: message.senderId,
      recipientName: message.recipient_name,
      recipientId: message.recipientId,
      createdAt: message.createdAt,
      emotions: message.emotions ? JSON.parse(message.emotions) : [],
    });

  } catch (error) {
    logger.error('Error moving up message:', error);
    res.status(500).json({ error: 'Failed to move up message' });
  }
});

// Health check
router.get('/health', (_req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'messages-routes'
  });
});

export const messagesRouter = router;
export default messagesRouter;