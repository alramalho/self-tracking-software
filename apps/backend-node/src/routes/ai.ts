import { Response, Router } from "express";
import multer from "multer";
import { z } from "zod/v4";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth";
import { aiService } from "../services/aiService";
import { coachAgentService } from "../services/coachAgentService";
import { notificationService } from "../services/notificationService";
import { sttService } from "../services/sttService";
import { TelegramService } from "../services/telegramService";
import { supermemoryService } from "../services/supermemoryService";
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

      // Get user's plans and metrics for parsing historical messages
      const plans = await prisma.plan.findMany({
        where: {
          userId: user.id,
          deletedAt: null,
        },
      });

      const metrics = await prisma.metric.findMany({
        where: {
          userId: user.id,
        },
      });

      // Helper to strip emojis from text
      const stripEmojis = (text: string) => {
        return text
          .replace(
            /[\p{Emoji}\p{Emoji_Presentation}\p{Emoji_Modifier}\p{Emoji_Component}]/gu,
            ""
          )
          .trim();
      };

      // Parse and structure messages
      const structuredMessages = messages.map((msg) => {
        if (msg.role === "COACH") {
          // New format: metadata field contains structured data
          if (msg.metadata && typeof msg.metadata === "object") {
            const metadata = msg.metadata as any;

            // Resolve plan goals to plan objects
            const planReplacements =
              metadata.planReplacements
                ?.map((replacement: any) => {
                  const plan = plans.find(
                    (p: any) =>
                      p.goal.toLowerCase() ===
                      replacement.planGoal.toLowerCase()
                  );
                  return plan
                    ? {
                        textToReplace: replacement.textToReplace,
                        plan: {
                          id: plan.id,
                          goal: plan.goal,
                          emoji: plan.emoji,
                        },
                      }
                    : null;
                })
                .filter(Boolean) || [];

            // Resolve metric title to metric object
            let metricReplacement: any = null;
            if (metadata.metricReplacement) {
              const aiMetricTitle = stripEmojis(
                metadata.metricReplacement.metricTitle
              ).toLowerCase();
              const metric = metrics.find(
                (m: any) => stripEmojis(m.title).toLowerCase() === aiMetricTitle
              );
              if (metric) {
                metricReplacement = {
                  textToReplace: metadata.metricReplacement.textToReplace,
                  rating: metadata.metricReplacement.rating,
                  metric: {
                    id: metric.id,
                    title: metric.title,
                    emoji: metric.emoji,
                  },
                  status: metadata.metricReplacement.status || null, // accepted, rejected, or null
                };
              }
            }

            return {
              id: msg.id,
              chatId: msg.chatId,
              role: msg.role,
              content: msg.content,
              planReplacements,
              metricReplacement,
              planProposals: metadata.planProposals || [],
              userRecommendations: metadata.userRecommendations || null,
              toolCalls: metadata.toolCalls || null,
              createdAt: msg.createdAt,
              feedback: msg.feedback,
            };
          }

          // Old format: content is JSON string (backward compatibility)
          try {
            const parsed = JSON.parse(msg.content);

            // Handle new format with planReplacements and metricReplacement
            if (parsed.messageContent) {
              // Resolve plan goals to plan objects
              const planReplacements =
                parsed.planReplacements
                  ?.map((replacement: any) => {
                    const plan = plans.find(
                      (p: any) =>
                        p.goal.toLowerCase() ===
                        replacement.planGoal.toLowerCase()
                    );
                    return plan
                      ? {
                          textToReplace: replacement.textToReplace,
                          plan: {
                            id: plan.id,
                            goal: plan.goal,
                            emoji: plan.emoji,
                          },
                        }
                      : null;
                  })
                  .filter(Boolean) || [];

              // Resolve metric title to metric object
              let metricReplacement: any = null;
              if (parsed.metricReplacement) {
                const aiMetricTitle = stripEmojis(
                  parsed.metricReplacement.metricTitle
                ).toLowerCase();
                const metric = metrics.find(
                  (m: any) =>
                    stripEmojis(m.title).toLowerCase() === aiMetricTitle
                );
                if (metric) {
                  metricReplacement = {
                    textToReplace: parsed.metricReplacement.textToReplace,
                    rating: parsed.metricReplacement.rating,
                    metric: {
                      id: metric.id,
                      title: metric.title,
                      emoji: metric.emoji,
                    },
                  };
                }
              }

              return {
                id: msg.id,
                chatId: msg.chatId,
                role: msg.role,
                content: parsed.messageContent,
                planReplacements,
                metricReplacement,
                userRecommendations: parsed.userRecommendations || null,
                toolCalls: parsed.toolCalls || null,
                createdAt: msg.createdAt,
                feedback: msg.feedback,
              };
            }

            // Fallback for old format
            return {
              id: msg.id,
              chatId: msg.chatId,
              role: msg.role,
              content: parsed.message || msg.content,
              planReplacements: [],
              metricReplacement: null,
              toolCalls: null,
              createdAt: msg.createdAt,
              feedback: msg.feedback,
            };
          } catch (e) {
            // Fallback for very old messages
            return {
              id: msg.id,
              chatId: msg.chatId,
              role: msg.role,
              content: msg.content,
              planReplacements: [],
              metricReplacement: null,
              toolCalls: null,
              createdAt: msg.createdAt,
              feedback: msg.feedback,
            };
          }
        }
        // USER messages
        return {
          id: msg.id,
          chatId: msg.chatId,
          role: msg.role,
          content: msg.content,
          createdAt: msg.createdAt,
          feedback: msg.feedback,
        };
      });

      logger.info(
        `Fetched ${messages.length} messages for chat ${chatId}, user ${user.username}`
      );

      res.json({ messages: structuredMessages });
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
      const { title, initialCoachMessage } = req.body;

      if (initialCoachMessage && typeof initialCoachMessage !== "string") {
        return res
          .status(400)
          .json({ error: "initialCoachMessage must be a string" });
      }

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

      if (initialCoachMessage) {
        await prisma.message.create({
          data: {
            chatId: chat.id,
            role: "COACH",
            content: initialCoachMessage,
          },
        });
      }

      logger.info(`Created new chat ${chat.id} for user ${user.username}`);

      res.json({ chat });
    } catch (error) {
      logger.error("Error creating chat:", error);
      res.status(500).json({ error: "Failed to create chat" });
    }
  }
);

// Clear all coach chat history and memory
router.delete(
  "/coach/history",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const user = req.user!;

      // Find all coach chats for this user
      const coachChats = await prisma.chat.findMany({
        where: { userId: user.id, type: "COACH" },
        select: { id: true },
      });

      const chatIds = coachChats.map((c) => c.id);

      if (chatIds.length > 0) {
        // Delete all messages in these chats (feedback cascades via onDelete)
        await prisma.message.deleteMany({
          where: { chatId: { in: chatIds } },
        });

        // Delete all coach chats
        await prisma.chat.deleteMany({
          where: { id: { in: chatIds } },
        });
      }

      // Wipe supermemory
      await supermemoryService.deleteAllMemories(user.id);

      logger.info(
        `Cleared coach history for user ${user.username}: ${chatIds.length} chats deleted`
      );

      res.json({ success: true });
    } catch (error) {
      logger.error("Error clearing coach history:", error);
      res.status(500).json({ error: "Failed to clear coach history" });
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

      // Create feedback in unified Feedback table
      const feedback = await prisma.feedback.create({
        data: {
          userId: user.id,
          messageId: messageId,
          category: "AI_MESSAGE_FEEDBACK",
          content: additionalComments || null,
          metadata: {
            feedbackType: feedbackType,
            feedbackReasons: feedbackReasons || [],
            timestamp: new Date().toISOString(),
          },
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

      // Get user's metrics for context
      const metrics = await prisma.metric.findMany({
        where: {
          userId: user.id,
        },
        orderBy: [{ createdAt: "desc" }],
      });

      const conversationHistory = history.map((msg) => ({
        role: msg.role === "USER" ? "user" : "assistant",
        content: msg.content,
      }));

      // Generate AI response using the new 2-step recommendation service
      const aiResponse = await aiService.generateCoachChatResponse({
        user: user,
        message: message,
        chatId: chatId,
        conversationHistory: conversationHistory,
        plans: plans,
        metrics: metrics,
      });

      // Save coach message with content and metadata separated
      const coachMessage = await prisma.message.create({
        data: {
          chatId: chatId,
          role: "COACH",
          content: aiResponse.messageContent,
          metadata: {
            planReplacements: aiResponse.planReplacements || [],
            metricReplacement: aiResponse.metricReplacement || null,
            userRecommendations: aiResponse.userRecommendations || null,
          },
        },
      });

      logger.info(
        `Coach chat - User: ${user.username}, Message: "${message.substring(0, 50)}...", Response: "${aiResponse.messageContent.substring(0, 50)}..."`
      );

      // Generate chat title if this is the first exchange (title is null)
      if (!chat.title) {
        // Do this async without blocking the response
        (async () => {
          try {
            const titlePrompt = `User: ${message}\nCoach: ${aiResponse.messageContent}`;
            const titleSystemPrompt =
              "You are a chat title generator. Create a very brief title (3-5 words max) that summarizes the topic of this conversation. " +
              "The title should be clear and concise. Only output the title, nothing else.";

            const generatedTitle = await aiService.generateText({
              prompt: titlePrompt,
              systemPrompt: titleSystemPrompt,
            });

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

      // Build response with structured data for frontend
      // Resolve plan goals to actual plan objects
      const resolvedPlanReplacements =
        aiResponse.planReplacements
          ?.map((replacement) => {
            const plan = plans.find(
              (p) => p.goal.toLowerCase() === replacement.planGoal.toLowerCase()
            );

            if (!plan) {
              logger.warn(`Plan not found for goal: ${replacement.planGoal}`);
              return null;
            }

            return {
              textToReplace: replacement.textToReplace,
              plan: {
                id: plan.id,
                goal: plan.goal,
                emoji: plan.emoji,
              },
            };
          })
          .filter(Boolean) || [];

      // Helper to strip emojis from text
      const stripEmojis = (text: string) => {
        return text
          .replace(
            /[\p{Emoji}\p{Emoji_Presentation}\p{Emoji_Modifier}\p{Emoji_Component}]/gu,
            ""
          )
          .trim();
      };

      // Resolve metric title to actual metric object
      let resolvedMetricReplacement: any = null;
      if (aiResponse.metricReplacement) {
        const aiMetricTitle = stripEmojis(
          aiResponse.metricReplacement.metricTitle
        ).toLowerCase();

        const metric = metrics.find(
          (m) => stripEmojis(m.title).toLowerCase() === aiMetricTitle
        );

        if (metric) {
          resolvedMetricReplacement = {
            textToReplace: aiResponse.metricReplacement.textToReplace,
            rating: aiResponse.metricReplacement.rating,
            metric: {
              id: metric.id,
              title: metric.title,
              emoji: metric.emoji,
            },
          };
        } else {
          logger.warn(
            `Metric not found for title: ${aiResponse.metricReplacement.metricTitle} (stripped: ${aiMetricTitle})`
          );
        }
      }

      const responseData = {
        id: coachMessage.id,
        chatId: coachMessage.chatId,
        role: coachMessage.role,
        content: aiResponse.messageContent,
        planReplacements: resolvedPlanReplacements,
        metricReplacement: resolvedMetricReplacement,
        userRecommendations: aiResponse.userRecommendations || null,
        createdAt: coachMessage.createdAt,
      };

      res.json({ message: responseData });
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

      const rewrittenMessage = await aiService.generateText({
        prompt,
        systemPrompt,
        options: {
          model: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
          temperature: 0.7,
        },
      });

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

// Accept metric suggestion from AI coach
router.post(
  "/messages/:messageId/accept-metric",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
      const { messageId } = req.params;
      const { date } = req.body; // Optional date, defaults to today

      // Fetch the message with metadata
      const message = await prisma.message.findUnique({
        where: { id: messageId },
        include: {
          chat: true,
        },
      });

      if (!message) {
        res.status(404).json({ error: "Message not found" });
        return;
      }

      // Verify message belongs to user's chat
      if (message.chat.userId !== user.id) {
        res.status(403).json({ error: "Unauthorized" });
        return;
      }

      // Check if message has metric replacement in metadata
      if (!message.metadata || typeof message.metadata !== "object") {
        res.status(400).json({ error: "Message has no metadata" });
        return;
      }

      const metadata = message.metadata as any;
      if (!metadata.metricReplacement) {
        res.status(400).json({ error: "Message has no metric suggestion" });
        return;
      }

      // Check if already accepted or rejected
      if (metadata.metricReplacement.status) {
        res.status(400).json({
          error: `Metric suggestion already ${metadata.metricReplacement.status}`,
        });
        return;
      }

      // Helper to strip emojis from text
      const stripEmojis = (text: string) => {
        return text
          .replace(
            /[\p{Emoji}\p{Emoji_Presentation}\p{Emoji_Modifier}\p{Emoji_Component}]/gu,
            ""
          )
          .trim();
      };

      // Find the metric by title (strip emojis and match)
      const aiMetricTitle = stripEmojis(
        metadata.metricReplacement.metricTitle
      ).toLowerCase();
      const allMetrics = await prisma.metric.findMany({
        where: { userId: user.id },
      });
      const metric = allMetrics.find(
        (m) => stripEmojis(m.title).toLowerCase() === aiMetricTitle
      );

      if (!metric) {
        res.status(404).json({ error: "Metric not found" });
        return;
      }

      // Convert rating from 1-5 to 1-10 (DB scale)
      const rating = metadata.metricReplacement.rating;
      const dbRating = rating * 2;

      // Log the metric entry
      const entryDate = date
        ? new Date(date)
        : new Date(new Date().toISOString().split("T")[0]);

      const existingEntry = await prisma.metricEntry.findFirst({
        where: {
          userId: user.id,
          metricId: metric.id,
          createdAt: entryDate,
        },
      });

      if (existingEntry) {
        await prisma.metricEntry.update({
          where: { id: existingEntry.id },
          data: { rating: dbRating },
        });
      } else {
        await prisma.metricEntry.create({
          data: {
            userId: user.id,
            metricId: metric.id,
            createdAt: entryDate,
            rating: dbRating,
          },
        });
      }

      // Update message metadata to mark as accepted
      metadata.metricReplacement.status = "accepted";
      await prisma.message.update({
        where: { id: messageId },
        data: { metadata },
      });

      logger.info(
        `User ${user.username} accepted metric suggestion: ${metric.title} with rating ${rating}/5`
      );

      res.json({ success: true });
    } catch (error) {
      logger.error("Error accepting metric suggestion:", error);
      res.status(500).json({ error: "Failed to accept metric suggestion" });
    }
  }
);

// Reject metric suggestion from AI coach
router.post(
  "/messages/:messageId/reject-metric",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
      const { messageId } = req.params;

      // Fetch the message with metadata
      const message = await prisma.message.findUnique({
        where: { id: messageId },
        include: {
          chat: true,
        },
      });

      if (!message) {
        res.status(404).json({ error: "Message not found" });
        return;
      }

      // Verify message belongs to user's chat
      if (message.chat.userId !== user.id) {
        res.status(403).json({ error: "Unauthorized" });
        return;
      }

      // Check if message has metric replacement in metadata
      if (!message.metadata || typeof message.metadata !== "object") {
        res.status(400).json({ error: "Message has no metadata" });
        return;
      }

      const metadata = message.metadata as any;
      if (!metadata.metricReplacement) {
        res.status(400).json({ error: "Message has no metric suggestion" });
        return;
      }

      // Check if already accepted or rejected
      if (metadata.metricReplacement.status) {
        res.status(400).json({
          error: `Metric suggestion already ${metadata.metricReplacement.status}`,
        });
        return;
      }

      // Update message metadata to mark as rejected
      metadata.metricReplacement.status = "rejected";
      await prisma.message.update({
        where: { id: messageId },
        data: { metadata },
      });

      logger.info(
        `User ${user.username} rejected metric suggestion: ${metadata.metricReplacement.metricTitle}`
      );

      res.json({ success: true });
    } catch (error) {
      logger.error("Error rejecting metric suggestion:", error);
      res.status(500).json({ error: "Failed to reject metric suggestion" });
    }
  }
);

// Accept a plan proposal from AI coach
router.post(
  "/messages/:messageId/accept-proposal",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
      const { messageId } = req.params;
      const { proposalIndex } = req.body;

      if (typeof proposalIndex !== "number") {
        res.status(400).json({ error: "proposalIndex is required (number)" });
        return;
      }

      const message = await prisma.message.findUnique({
        where: { id: messageId },
        include: { chat: true },
      });

      if (!message) {
        res.status(404).json({ error: "Message not found" });
        return;
      }

      if (message.chat.userId !== user.id) {
        res.status(403).json({ error: "Unauthorized" });
        return;
      }

      const metadata = message.metadata as any;
      if (
        !metadata?.planProposals ||
        !metadata.planProposals[proposalIndex]
      ) {
        res.status(400).json({ error: "Proposal not found" });
        return;
      }

      const proposal = metadata.planProposals[proposalIndex];

      if (proposal.status) {
        res.status(400).json({
          error: `Proposal already ${proposal.status}`,
        });
        return;
      }

      // Verify the plan belongs to the user
      const plan = await prisma.plan.findFirst({
        where: { id: proposal.planId, userId: user.id, deletedAt: null },
        include: { activities: true, sessions: true },
      });

      if (!plan) {
        res.status(404).json({ error: "Plan not found" });
        return;
      }

      // Execute the operations
      const changes: Array<{
        operation: string;
        sessionId?: string;
        success: boolean;
        error?: string;
      }> = [];

      for (const op of proposal.operations) {
        try {
          if (op.type === "add") {
            const activity = plan.activities.find(
              (a: any) => a.id === op.activityId
            );
            if (!activity) {
              changes.push({
                operation: "add",
                success: false,
                error: `Activity ${op.activityId} not found in plan`,
              });
              continue;
            }

            const sessionDate = new Date(op.date);
            const newSession = await prisma.planSession.create({
              data: {
                planId: proposal.planId,
                activityId: op.activityId,
                date: new Date(
                  Date.UTC(
                    sessionDate.getFullYear(),
                    sessionDate.getMonth(),
                    sessionDate.getDate()
                  )
                ),
                quantity: op.quantity,
                descriptiveGuide: op.descriptiveGuide || "",
                isCoachSuggested: true,
              },
            });

            changes.push({
              operation: "add",
              sessionId: newSession.id,
              success: true,
            });
          } else if (op.type === "update") {
            const session = plan.sessions.find(
              (s: any) => s.id === op.sessionId
            );
            if (!session) {
              changes.push({
                operation: "update",
                sessionId: op.sessionId,
                success: false,
                error: "Session not found",
              });
              continue;
            }

            const updateData: Record<string, unknown> = {};
            if (op.date) {
              const d = new Date(op.date);
              updateData.date = new Date(
                Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
              );
            }
            if (op.quantity !== undefined) updateData.quantity = op.quantity;
            if (op.descriptiveGuide !== undefined)
              updateData.descriptiveGuide = op.descriptiveGuide;

            await prisma.planSession.update({
              where: { id: op.sessionId },
              data: updateData,
            });

            changes.push({
              operation: "update",
              sessionId: op.sessionId,
              success: true,
            });
          } else if (op.type === "remove") {
            const session = plan.sessions.find(
              (s: any) => s.id === op.sessionId
            );
            if (!session) {
              changes.push({
                operation: "remove",
                sessionId: op.sessionId,
                success: false,
                error: "Session not found",
              });
              continue;
            }

            await prisma.planSession.delete({
              where: { id: op.sessionId },
            });

            changes.push({
              operation: "remove",
              sessionId: op.sessionId,
              success: true,
            });
          }
        } catch (error) {
          logger.error("Proposal operation failed:", error);
          changes.push({
            operation: op.type,
            sessionId: "sessionId" in op ? op.sessionId : undefined,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      // Update proposal status in metadata
      metadata.planProposals[proposalIndex].status = "accepted";
      await prisma.message.update({
        where: { id: messageId },
        data: { metadata },
      });

      const successCount = changes.filter((c) => c.success).length;
      logger.info(
        `User ${user.username} accepted proposal: "${proposal.description}" (${successCount}/${proposal.operations.length} ops successful)`
      );

      // Conclude week_recap notification if all proposals are now resolved
      if (metadata.notificationType === "week_recap") {
        const allResolved = metadata.planProposals.every(
          (p: any) => !!p.status
        );
        if (allResolved) {
          await prisma.notification.updateMany({
            where: {
              userId: user.id,
              type: "COACH",
              title: "Weekly Recap",
              relatedId: message.chatId,
              status: { not: "CONCLUDED" },
            },
            data: {
              status: "CONCLUDED",
              concludedAt: new Date(),
            },
          });
          logger.info(
            `Concluded week_recap notification after all proposals resolved for chat ${message.chatId}`
          );
        }
      }

      res.json({ success: true, changes });
    } catch (error) {
      logger.error("Error accepting plan proposal:", error);
      res.status(500).json({ error: "Failed to accept plan proposal" });
    }
  }
);

// Reject a plan proposal from AI coach
router.post(
  "/messages/:messageId/reject-proposal",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
      const { messageId } = req.params;
      const { proposalIndex } = req.body;

      if (typeof proposalIndex !== "number") {
        res.status(400).json({ error: "proposalIndex is required (number)" });
        return;
      }

      const message = await prisma.message.findUnique({
        where: { id: messageId },
        include: { chat: true },
      });

      if (!message) {
        res.status(404).json({ error: "Message not found" });
        return;
      }

      if (message.chat.userId !== user.id) {
        res.status(403).json({ error: "Unauthorized" });
        return;
      }

      const metadata = message.metadata as any;
      if (
        !metadata?.planProposals ||
        !metadata.planProposals[proposalIndex]
      ) {
        res.status(400).json({ error: "Proposal not found" });
        return;
      }

      if (metadata.planProposals[proposalIndex].status) {
        res.status(400).json({
          error: `Proposal already ${metadata.planProposals[proposalIndex].status}`,
        });
        return;
      }

      metadata.planProposals[proposalIndex].status = "rejected";
      await prisma.message.update({
        where: { id: messageId },
        data: { metadata },
      });

      logger.info(
        `User ${user.username} rejected proposal: "${metadata.planProposals[proposalIndex].description}"`
      );

      // Conclude week_recap notification if all proposals are now resolved
      if (metadata.notificationType === "week_recap") {
        const allResolved = metadata.planProposals.every(
          (p: any) => !!p.status
        );
        if (allResolved) {
          await prisma.notification.updateMany({
            where: {
              userId: user.id,
              type: "COACH",
              title: "Weekly Recap",
              relatedId: message.chatId,
              status: { not: "CONCLUDED" },
            },
            data: {
              status: "CONCLUDED",
              concludedAt: new Date(),
            },
          });
          logger.info(
            `Concluded week_recap notification after all proposals resolved for chat ${message.chatId}`
          );
        }
      }

      res.json({ success: true });
    } catch (error) {
      logger.error("Error rejecting plan proposal:", error);
      res.status(500).json({ error: "Failed to reject plan proposal" });
    }
  }
);

// Accept an activity log proposal from AI coach
router.post(
  "/messages/:messageId/accept-activity-log-proposal",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
      const { messageId } = req.params;
      const { proposalIndex } = req.body;

      if (typeof proposalIndex !== "number") {
        res.status(400).json({ error: "proposalIndex is required (number)" });
        return;
      }

      const message = await prisma.message.findUnique({
        where: { id: messageId },
        include: { chat: true },
      });

      if (!message) {
        res.status(404).json({ error: "Message not found" });
        return;
      }

      if (message.chat.userId !== user.id) {
        res.status(403).json({ error: "Unauthorized" });
        return;
      }

      const metadata = message.metadata as any;
      if (
        !metadata?.activityLogProposals ||
        !metadata.activityLogProposals[proposalIndex]
      ) {
        res.status(400).json({ error: "Proposal not found" });
        return;
      }

      const proposal = metadata.activityLogProposals[proposalIndex];

      if (proposal.status) {
        res.status(400).json({
          error: `Proposal already ${proposal.status}`,
        });
        return;
      }

      // Verify the activity belongs to the user
      const activity = await prisma.activity.findFirst({
        where: { id: proposal.activityId, userId: user.id, deletedAt: null },
      });

      if (!activity) {
        res.status(404).json({ error: "Activity not found" });
        return;
      }

      // Check for existing entry on this date
      const proposalDatetime = new Date(proposal.date + "T" + (proposal.time || "00:00:00") + ".000Z");
      const existingEntry = await prisma.activityEntry.findFirst({
        where: {
          activityId: proposal.activityId,
          userId: user.id,
          datetime: proposalDatetime,
          deletedAt: null,
        },
      });

      if (existingEntry) {
        await prisma.activityEntry.update({
          where: { id: existingEntry.id },
          data: {
            quantity: existingEntry.quantity + proposal.quantity,
          },
        });
      } else {
        await prisma.activityEntry.create({
          data: {
            activityId: proposal.activityId,
            userId: user.id,
            quantity: proposal.quantity,
            datetime: proposalDatetime,
          },
        });
      }

      // Update proposal status in metadata
      metadata.activityLogProposals[proposalIndex].status = "accepted";
      await prisma.message.update({
        where: { id: messageId },
        data: { metadata },
      });

      logger.info(
        `User ${user.username} accepted activity log proposal: ${proposal.activityEmoji} ${proposal.activityName} x${proposal.quantity} on ${proposal.date}`
      );

      res.json({ success: true });
    } catch (error) {
      logger.error("Error accepting activity log proposal:", error);
      res.status(500).json({ error: "Failed to accept activity log proposal" });
    }
  }
);

// Reject an activity log proposal from AI coach
router.post(
  "/messages/:messageId/reject-activity-log-proposal",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
      const { messageId } = req.params;
      const { proposalIndex } = req.body;

      if (typeof proposalIndex !== "number") {
        res.status(400).json({ error: "proposalIndex is required (number)" });
        return;
      }

      const message = await prisma.message.findUnique({
        where: { id: messageId },
        include: { chat: true },
      });

      if (!message) {
        res.status(404).json({ error: "Message not found" });
        return;
      }

      if (message.chat.userId !== user.id) {
        res.status(403).json({ error: "Unauthorized" });
        return;
      }

      const metadata = message.metadata as any;
      if (
        !metadata?.activityLogProposals ||
        !metadata.activityLogProposals[proposalIndex]
      ) {
        res.status(400).json({ error: "Proposal not found" });
        return;
      }

      if (metadata.activityLogProposals[proposalIndex].status) {
        res.status(400).json({
          error: `Proposal already ${metadata.activityLogProposals[proposalIndex].status}`,
        });
        return;
      }

      metadata.activityLogProposals[proposalIndex].status = "rejected";
      await prisma.message.update({
        where: { id: messageId },
        data: { metadata },
      });

      logger.info(
        `User ${user.username} rejected activity log proposal: ${metadata.activityLogProposals[proposalIndex].activityEmoji} ${metadata.activityLogProposals[proposalIndex].activityName}`
      );

      res.json({ success: true });
    } catch (error) {
      logger.error("Error rejecting activity log proposal:", error);
      res.status(500).json({ error: "Failed to reject activity log proposal" });
    }
  }
);

// Submit AI overall satisfaction feedback
router.post(
  "/feedback/ai-satisfaction",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
      const { liked, content } = req.body;

      if (typeof liked !== "boolean") {
        res.status(400).json({ error: "liked field is required (boolean)" });
        return;
      }

      // Create feedback entry
      const feedback = await prisma.feedback.create({
        data: {
          userId: user.id,
          category: "AI_OVERALL_FEEDBACK",
          content: content || null,
          metadata: {
            liked,
            timestamp: new Date().toISOString(),
          },
        },
      });

      logger.info(
        `User ${user.username} submitted AI satisfaction feedback: ${liked ? "liked" : "disliked"}`
      );

      res.json({ success: true, feedback });
    } catch (error) {
      logger.error("Error submitting AI satisfaction feedback:", error);
      res.status(500).json({ error: "Failed to submit feedback" });
    }
  }
);

// Classify whether a plan goal would benefit from coaching
router.post(
  "/classify-coaching-need",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const { planGoal } = req.body;

      if (!planGoal || typeof planGoal !== "string") {
        return res.status(400).json({ error: "planGoal is required" });
      }

      const result = await aiService.classifyCoachingNeed(planGoal);

      res.json(result);
    } catch (error) {
      logger.error("Error classifying coaching need:", error);
      res.status(500).json({ error: "Failed to classify coaching need" });
    }
  }
);

// Recommend activities based on plan goal
router.post(
  "/recommend-activities",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const user = req.user!;
      const { planGoal } = req.body;

      if (!planGoal || typeof planGoal !== "string") {
        return res.status(400).json({ error: "planGoal is required" });
      }

      // Get user's existing activities
      const activities = await prisma.activity.findMany({
        where: { userId: user.id },
        select: { id: true, title: true, emoji: true },
      });

      const result = await aiService.recommendActivities(planGoal, activities);

      logger.info(
        `Recommended ${result.recommendedActivityIds.length} activities for goal "${planGoal.substring(0, 50)}..."`
      );

      res.json(result);
    } catch (error) {
      logger.error("Error recommending activities:", error);
      res.status(500).json({ error: "Failed to recommend activities" });
    }
  }
);

// Trigger a coaching notification (week_recap or pre_activity)
router.post(
  "/coach/trigger-notification",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const user = req.user!;
      const { type } = req.body;

      if (!type || !["week_recap", "pre_activity"].includes(type)) {
        return res
          .status(400)
          .json({ error: "type must be 'week_recap' or 'pre_activity'" });
      }

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
      }

      // Get or create the latest coach chat
      let chat = await prisma.chat.findFirst({
        where: {
          userId: user.id,
          coachId: coach.id,
        },
        orderBy: { updatedAt: "desc" },
      });

      if (!chat) {
        chat = await prisma.chat.create({
          data: {
            userId: user.id,
            coachId: coach.id,
            title: null,
          },
        });
      }

      // Fetch user's plans with activities and sessions
      const plans = await prisma.plan.findMany({
        where: {
          userId: user.id,
          deletedAt: null,
          OR: [
            { finishingDate: null },
            { finishingDate: { gt: new Date() } },
          ],
        },
        include: {
          activities: true,
          sessions: true,
        },
        orderBy: [{ createdAt: "desc" }],
      });

      // Fetch active reminders
      const reminders = await prisma.reminder.findMany({
        where: {
          userId: user.id,
          status: "PENDING",
        },
        orderBy: { triggerAt: "asc" },
      });

      // Build the internal prompt based on notification type
      let internalPrompt: string;
      if (type === "week_recap") {
        internalPrompt =
          "Use readActivities for the past 7 days and produce a weekly recap for the user. " +
          "Highlight what went well, what was missed, and for each missed area use proposePlanModification to suggest a concrete change — " +
          "e.g. removing upcoming sessions for a plan that's consistently not being followed, or adjusting session quantities. " +
          "Keep the text concise (3-5 sentences).";
      } else {
        internalPrompt =
          "Use readActivities for the past 1 day to see today's scheduled activities. " +
          "Give the user a brief rundown of what's on their plate today and a short motivational message. " +
          "Keep it concise (2-3 sentences).";
      }

      // Generate the coach response
      const aiResponse = await coachAgentService.generateResponse({
        user,
        message: internalPrompt,
        conversationHistory: [],
        plans,
        reminders,
      });

      // Save multiple coach messages (one per draft)
      type DraftType = (typeof aiResponse.draftMessages)[number];
      const savedMessages: Array<{ coachMsg: Awaited<ReturnType<typeof prisma.message.create>>; draft: DraftType }> = [];
      for (const draft of aiResponse.draftMessages) {
        const coachMsg = await prisma.message.create({
          data: {
            chatId: chat.id,
            role: "COACH",
            content: draft.content,
            metadata: {
              planReplacements: draft.planReplacements || [],
              planProposals: JSON.parse(JSON.stringify(draft.planProposals || [])),
              notificationType: type,
              ...(draft.toolCalls && {
                toolCalls: JSON.parse(JSON.stringify(draft.toolCalls)),
              }),
            },
          },
        });
        savedMessages.push({ coachMsg, draft });
      }

      // Update chat timestamp
      await prisma.chat.update({
        where: { id: chat.id },
        data: { updatedAt: new Date() },
      });

      // Send push notification using first draft's content
      const firstDraftContent = aiResponse.draftMessages[0].content;
      await notificationService.createAndProcessNotification({
        userId: user.id,
        title: type === "week_recap" ? "Weekly Recap" : "Today's Plan",
        message: type === "week_recap" ? "Your week analysis is ready!" : firstDraftContent.substring(0, 200),
        type: "COACH",
        relatedId: chat.id,
        promptTag: type,
      });

      logger.info(
        `Triggered ${type} notification for user ${user.username}, chat ${chat.id}, drafts: ${savedMessages.length}`
      );

      const responseMessages = savedMessages.map(({ coachMsg, draft }) => ({
        id: coachMsg.id,
        chatId: coachMsg.chatId,
        role: coachMsg.role,
        content: draft.content,
        planReplacements: draft.planReplacements || [],
        planProposals: draft.planProposals || [],
        toolCalls: draft.toolCalls || null,
        createdAt: coachMsg.createdAt,
      }));

      res.json({
        messages: responseMessages,
        message: responseMessages[responseMessages.length - 1],
        chatId: chat.id,
      });
    } catch (error) {
      logger.error("Error triggering coach notification:", error);
      res
        .status(500)
        .json({ error: "Failed to trigger coaching notification" });
    }
  }
);

export const aiRouter: Router = router;
export default aiRouter;
