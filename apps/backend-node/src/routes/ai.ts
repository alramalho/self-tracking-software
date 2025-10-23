import { Response, Router } from "express";
import multer from "multer";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth";
import { aiService } from "../services/aiService";
import { memoryService } from "../services/memoryService";
import { notificationService } from "../services/notificationService";
import { plansService } from "../services/plansService";
import { sttService } from "../services/sttService";
import { TelegramService } from "../services/telegramService";
import { logger } from "../utils/logger";
import { prisma } from "../utils/prisma";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });
const telegramService = new TelegramService();

// Get coach messages (conversation history)
router.get(
  "/coach/messages",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const user = req.user!;
      const { chatId } = req.query;

      if (!chatId || typeof chatId !== "string") {
        return res.status(400).json({ error: "chatId is required" });
      }

      // Verify chat belongs to user
      const chat = await prisma.chat.findFirst({
        where: {
          id: chatId,
          userId: user.id,
        },
      });

      if (!chat) {
        return res.status(404).json({ error: "Chat not found" });
      }

      // Fetch all messages for this chat
      const messages = await prisma.message.findMany({
        where: {
          chatId: chatId,
        },
        include: {
          feedback: true,
        },
        orderBy: { createdAt: "asc" },
      });

      logger.info(
        `Fetched ${messages.length} messages for chat ${chatId}, user ${user.username}`
      );

      res.json({ messages });
    } catch (error) {
      logger.error("Error fetching coach messages:", error);
      res.status(500).json({ error: "Failed to fetch coach messages" });
    }
  }
);

// Get all user chats
router.get(
  "/coach/chats",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const user = req.user!;

      // Get user's coach
      const coach = await prisma.coach.findFirst({
        where: { ownerId: user.id },
      });

      if (!coach) {
        // No coach yet, return empty chats
        return res.json({ chats: [] });
      }

      // Fetch all chats for this user and coach
      const chats = await prisma.chat.findMany({
        where: {
          userId: user.id,
          coachId: coach.id,
        },
        orderBy: { updatedAt: "desc" },
      });

      logger.info(`Fetched ${chats.length} chats for user ${user.username}`);

      res.json({ chats });
    } catch (error) {
      logger.error("Error fetching chats:", error);
      res.status(500).json({ error: "Failed to fetch chats" });
    }
  }
);

// Create a new chat
router.post(
  "/coach/chats",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const user = req.user!;
      const { title } = req.body;

      // Get or create coach
      let coach = await prisma.coach.findFirst({
        where: { ownerId: user.id },
      });

      if (!coach) {
        coach = await prisma.coach.create({
          data: {
            ownerId: user.id,
            details: {
              name: "Coach Oli",
              bio: "Your personal AI coach helping you achieve your goals",
            },
          },
        });
        logger.info(`Created new coach for user '${user.username}'`);
      }

      // Create new chat
      const chat = await prisma.chat.create({
        data: {
          userId: user.id,
          coachId: coach.id,
          title: title || null,
        },
      });

      logger.info(`Created new chat ${chat.id} for user ${user.username}`);

      res.json({ chat });
    } catch (error) {
      logger.error("Error creating chat:", error);
      res.status(500).json({ error: "Failed to create chat" });
    }
  }
);

// Update chat title
router.patch(
  "/coach/chats/:chatId",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const user = req.user!;
      const { chatId } = req.params;
      const { title } = req.body;

      if (!title || typeof title !== "string" || !title.trim()) {
        return res.status(400).json({ error: "Title is required" });
      }

      // Verify chat belongs to user
      const chat = await prisma.chat.findFirst({
        where: {
          id: chatId,
          userId: user.id,
        },
      });

      if (!chat) {
        return res.status(404).json({ error: "Chat not found" });
      }

      // Update chat title
      const updatedChat = await prisma.chat.update({
        where: { id: chatId },
        data: { title: title.trim() },
      });

      logger.info(
        `Updated chat ${chatId} title to "${title}" for user ${user.username}`
      );

      res.json({ chat: updatedChat });
    } catch (error) {
      logger.error("Error updating chat title:", error);
      res.status(500).json({ error: "Failed to update chat title" });
    }
  }
);

// Submit message feedback
router.post(
  "/coach/messages/:messageId/feedback",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const user = req.user!;
      const { messageId } = req.params;
      const { feedbackType, feedbackReasons, additionalComments } = req.body;

      if (!feedbackType || !["POSITIVE", "NEGATIVE"].includes(feedbackType)) {
        return res.status(400).json({
          error: "Valid feedbackType is required (POSITIVE or NEGATIVE)",
        });
      }

      // Verify message exists and user has access to it
      const message = await prisma.message.findFirst({
        where: {
          id: messageId,
          chat: {
            userId: user.id,
          },
        },
      });

      if (!message) {
        return res.status(404).json({ error: "Message not found" });
      }

      // Create or update feedback
      const feedback = await prisma.messageFeedback.upsert({
        where: {
          messageId_userId: {
            messageId: messageId,
            userId: user.id,
          },
        },
        create: {
          messageId: messageId,
          userId: user.id,
          feedbackType: feedbackType,
          feedbackReasons: feedbackReasons || [],
          additionalComments: additionalComments || null,
        },
        update: {
          feedbackType: feedbackType,
          feedbackReasons: feedbackReasons || [],
          additionalComments: additionalComments || null,
        },
      });

      logger.info(
        `Message feedback submitted - User: ${user.username}, MessageId: ${messageId}, Type: ${feedbackType}`
      );

      res.json({ feedback });
    } catch (error) {
      logger.error("Error submitting message feedback:", error);
      res.status(500).json({ error: "Failed to submit feedback" });
    }
  }
);

// Send message to coach (chat)
router.post(
  "/coach/chat",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const user = req.user!;
      const { message, chatId } = req.body;

      if (!message || typeof message !== "string" || !message.trim()) {
        return res.status(400).json({ error: "Message is required" });
      }

      if (!chatId || typeof chatId !== "string") {
        return res.status(400).json({ error: "chatId is required" });
      }

      // Verify chat belongs to user
      const chat = await prisma.chat.findFirst({
        where: {
          id: chatId,
          userId: user.id,
        },
        include: {
          coach: true,
        },
      });

      if (!chat) {
        return res.status(404).json({ error: "Chat not found" });
      }

      // Save user message
      await prisma.message.create({
        data: {
          chatId: chatId,
          role: "USER",
          content: message,
        },
      });

      // Get conversation history (last 20 messages for context)
      const history = await prisma.message.findMany({
        where: {
          chatId: chatId,
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      });

      // Reverse to chronological order
      history.reverse();

      // Get user's plans for context
      const plans = await prisma.plan.findMany({
        where: {
          userId: user.id,
          deletedAt: null,
          OR: [{ finishingDate: null }, { finishingDate: { gt: new Date() } }],
        },
        include: {
          activities: true,
        },
        orderBy: [{ createdAt: "desc" }],
      });

      // Build context for AI
      let plansContext = "";
      if (plans.length > 0) {
        plansContext =
          "\n\nUser's current plans:\n" +
          plans
            .map((p) => {
              const activities = p.activities.map((a) => a.title).join(", ");
              return `- Goal: "${p.goal}" / Activities: ${activities}`;
            })
            .join("\n");
      }

      // Build conversation history
      const conversationHistory = history.map((msg) => ({
        role: msg.role === "USER" ? "user" : "assistant",
        content: msg.content,
      }));

      // System prompt for coach
      const systemPrompt =
        `You are Coach Oli, a supportive personal AI coach helping users achieve their goals and stay on track with their plans.` +
        `${plansContext}` +
        `\n\n` +
        `Guidelines:` +
        `\n- Keep responses concise (2-3 sentences)` +
        `\n- When mentioning a plan, use this exact markdown format: [natural text](plan-goal-exact-goal-text)` +
        `\n  - The text in brackets should flow naturally in the sentence` +
        `\n  - Replace spaces with hyphens in the URL (e.g., "play a bit of chess" becomes "play-a-bit-of-chess")` +
        `\n  - The goal text must match the EXACT goal from the list above (with spaces replaced by hyphens)` +
        `\n  Examples: "your [chess practice](plan-goal-play-a-bit-of-chess-every-day)", "the [reading goal](plan-goal-read-12-books)"` +
        `\n- Provide actionable advice` +
        `\n- Copy user's tone over time, as conversation progresses`;

      // Generate AI response
      const aiResponse = await aiService.generateText(
        conversationHistory.map((m) => `${m.role}: ${m.content}`).join("\n") +
          "\nassistant:",
        systemPrompt,
        { model: "x-ai/grok-4-fast", temperature: 0.5 }
      );

      // Save coach message (AI now handles the plan link format directly)
      const coachMessage = await prisma.message.create({
        data: {
          chatId: chatId,
          role: "COACH",
          content: aiResponse,
        },
      });

      logger.info(
        `Coach chat - User: ${user.username}, Message: "${message.substring(0, 50)}...", Response: "${aiResponse.substring(0, 50)}..."`
      );

      // Generate chat title if this is the first exchange (title is null)
      if (!chat.title) {
        // Do this async without blocking the response
        (async () => {
          try {
            const titlePrompt = `User: ${message}\nCoach: ${aiResponse}`;
            const titleSystemPrompt =
              "You are a chat title generator. Create a very brief title (3-5 words max) that summarizes the topic of this conversation. " +
              "The title should be clear and concise. Only output the title, nothing else.";

            const generatedTitle = await aiService.generateText(
              titlePrompt,
              titleSystemPrompt
            );

            // Update chat with the generated title
            await prisma.chat.update({
              where: { id: chatId },
              data: { title: generatedTitle.trim() },
            });

            logger.info(
              `Generated title for chat ${chatId}: "${generatedTitle}"`
            );
          } catch (error) {
            logger.error("Error generating chat title:", error);
            // Don't fail the request if title generation fails
          }
        })();
      }

      res.json({ message: coachMessage });
    } catch (error) {
      logger.error("Error in coach chat:", error);
      res.status(500).json({ error: "Failed to process chat message" });
    }
  }
);

// Audio transcription endpoint
router.post(
  "/transcribe",
  requireAuth,
  upload.single("audio_file"),
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const audioFile = req.file;
      const audioFormat = req.body.audio_format;

      if (!audioFile) {
        return res.status(400).json({ error: "No audio file provided" });
      }

      logger.info(
        `Audio transcription requested for user ${req.user!.id}, format: ${audioFormat || "auto-detect"}`
      );

      // Use the STT service to transcribe the audio
      const transcribedText = await sttService.speechToText(
        audioFile.buffer,
        audioFormat
      );

      res.json({
        text: transcribedText,
        success: true,
      });
    } catch (error) {
      logger.error("Error in audio transcription:", error);
      res.status(500).json({ error: "Audio transcription failed" });
    }
  }
);

// Dynamic UI logging endpoints
router.post(
  "/log-dynamic-ui-attempt-error",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const { question_checks, attempts, id, extracted_data } = req.body;

      logger.info(
        `Dynamic UI attempt error logged for user ${req.user!.username}, attempts: ${attempts}, id: ${id}`
      );
      logger.debug("Question checks:", question_checks);
      logger.debug("Extracted data:", extracted_data);

      // Send to Telegram notification service for significant errors
      if (attempts >= 3) {
        telegramService.sendMessage(
          `⚠️ User struggling to accept the AI extraction in step ${id}\n\n` +
            `User: ${req.user!.username}\n` +
            `Attempts: ${attempts}\n` +
            `Extracted data: ${JSON.stringify(extracted_data, null, 2)}\n` +
            `UTC Time: ${new Date().toISOString()}`
        );
      }

      res.json({ status: "success" });
    } catch (error) {
      logger.error("Error logging dynamic UI attempt error:", error);
      res.status(500).json({ error: "Failed to log error" });
    }
  }
);

router.post(
  "/log-dynamic-ui-skip",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const { question_checks, attempts, extracted_data, id } = req.body;

      logger.info(
        `Dynamic UI skip logged for user ${req.user!.username}, attempts: ${attempts}, id: ${id}`
      );
      logger.debug("Question checks:", question_checks);
      logger.debug("Extracted data:", extracted_data);

      // Send to Telegram notification service for pattern analysis
      telegramService.sendMessage(
        `⏭️ Dynamic UI skip\n\n` +
          `User: ${req.user!.username}\n` +
          `Attempts: ${attempts}\n` +
          `ID: ${id}\n` +
          `UTC Time: ${new Date().toISOString()}`
      );

      res.json({ status: "success" });
    } catch (error) {
      logger.error("Error logging dynamic UI skip:", error);
      res.status(500).json({ error: "Failed to log skip" });
    }
  }
);

// Rewrite testimonial message with AI
router.post(
  "/rewrite-testimonial",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const user = req.user!;
      const { sentiment, message } = req.body;

      if (!sentiment || !message || typeof message !== "string") {
        return res
          .status(400)
          .json({ error: "sentiment and message are required" });
      }

      // Map sentiment to descriptive label
      const sentimentLabels = [
        "very unhappy",
        "unhappy",
        "happy",
        "very happy",
      ];
      const sentimentLabel = sentimentLabels[sentiment - 1];

      const systemPrompt = `You are a testimonial editor for tracking.so, a habit tracking app. Your job is to rewrite user testimonials to make them more polished and compelling while preserving their authentic voice and sentiment. Keep testimonials concise (1-3 sentences, ~30-60 words) and in first person.`;

      const prompt = `Rewrite this testimonial for tracking.so:

Original: "${message}"
User sentiment: ${sentimentLabel}

Make it more polished and compelling while keeping the user's authentic voice and sentiment. Keep it concise and natural.`;

      const rewrittenMessage = await aiService.generateText(
        prompt,
        systemPrompt,
        {
          model: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
          temperature: 0.7,
        }
      );

      // Remove leading and trailing quotes if present
      const cleanedMessage = rewrittenMessage
        .trim()
        .replace(/^["']|["']$/g, "");

      logger.info(`Rewrote testimonial for user ${user.username}`);

      res.json({ message: cleanedMessage });
    } catch (error) {
      logger.error("Error rewriting testimonial:", error);
      res.status(500).json({ error: "Failed to rewrite testimonial" });
    }
  }
);

export const aiRouter: Router = router;
export default aiRouter;
