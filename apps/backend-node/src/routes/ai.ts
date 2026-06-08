import { Response, Router } from "express";
import multer from "multer";
import { z } from "zod/v4";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth";
import { aiService } from "../services/aiService";
import { coachAssessmentService } from "../services/coach/assessment/service";
import { deriveCoachAttentionItems } from "../services/coachAttentionService";
import { coachAgentService } from "../services/coach/agent";
import { toCoachConversationHistory } from "../services/coachConversationHistoryService";
import { getCoachPersonalityConfig } from "../services/coachPersonalityService";
import { notificationService } from "../services/notificationService";
import { updateActivityWithMeasureConversion } from "../services/activityUpdateService";
import { cancelPendingPlanCreationProposals } from "../services/planCreationProposalStatusService";
import {
  executePlanProposalPatch,
  getProposalPatch,
} from "../services/planProposalPatchService";
import { sttService } from "../services/sttService";
import { TelegramService } from "../services/telegramService";
import { supermemoryService } from "../services/supermemoryService";
import { logger } from "../utils/logger";
import { prisma } from "../utils/prisma";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });
const telegramService = new TelegramService();
const AUTONOMOUS_COACH_PROMPT_TAG = "autonomous_coach";

function activePlanWhere(now: Date) {
  return {
    deletedAt: null,
    archivedAt: null,
    isPaused: false,
    OR: [{ finishingDate: null }, { finishingDate: { gt: now } }],
  };
}

function normalizeOptionalText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

const planCreationProposalChangesSchema = z.object({
  proposalIndex: z.number(),
  requestedProposal: z.object({
    goal: z.string().optional(),
    goalReason: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    emoji: z.string().nullable().optional(),
    outlineType: z.enum(["SPECIFIC", "TIMES_PER_WEEK"]).nullable().optional(),
    timesPerWeek: z.number().nullable().optional(),
    finishingDate: z.string().nullable().optional(),
    activities: z
      .array(
        z.object({
          activityId: z.string().nullable().optional(),
          title: z.string(),
          measure: z.string(),
          emoji: z.string(),
          kind: z.string().nullable().optional(),
        })
      )
      .optional(),
    milestones: z
      .array(
        z.object({
          description: z.string(),
          date: z.string().nullable().optional(),
          criteria: z.string().nullable().optional(),
        })
      )
      .optional(),
    sessions: z
      .array(
        z.object({
          activityTitle: z.string(),
          date: z.string(),
          quantity: z.number().nullable().optional(),
          descriptiveGuide: z.string().nullable().optional(),
        })
      )
      .optional(),
  }),
  note: z.string().nullable().optional(),
});

function formatPlanCreationValue(field: string, value: unknown): string {
  if (field === "outlineType") {
    return value === "SPECIFIC" ? "Specific sessions" : value === "TIMES_PER_WEEK" ? "Times per week" : "Not set";
  }
  if (field === "timesPerWeek") {
    return typeof value === "number" ? `${value}x/week` : "Not set";
  }
  if (field === "finishingDate") {
    return typeof value === "string" && value ? value : "No end date";
  }
  if (field === "goalReason") {
    return typeof value === "string" && value.trim() ? value : "No reason";
  }
  if (field === "notes") {
    return typeof value === "string" && value.trim() ? value : "No notes";
  }
  if (field === "activities" && Array.isArray(value)) {
    return value.length > 0
      ? value.map((activity: any) => `${activity.emoji || "📋"} ${activity.title} (${activity.measure || "sessions"})`).join(", ")
      : "None";
  }
  if (field === "sessions" && Array.isArray(value)) {
    return value.length > 0 ? `${value.length} dated session${value.length === 1 ? "" : "s"}` : "None";
  }
  if (field === "milestones" && Array.isArray(value)) {
    return value.length > 0 ? `${value.length} milestone${value.length === 1 ? "" : "s"}` : "None";
  }
  if (typeof value === "string" && value.trim()) return value;
  return "Not set";
}

function normalizePlanCreationProposal(proposal: any) {
  const sessions = Array.isArray(proposal.sessions) ? proposal.sessions : [];
  const outlineType =
    sessions.length > 0 || !proposal.timesPerWeek
      ? proposal.outlineType || "SPECIFIC"
      : "TIMES_PER_WEEK";

  return {
    goal: proposal.goal || "",
    goalReason: proposal.goalReason || null,
    notes: proposal.notes || null,
    emoji: proposal.emoji || "🎯",
    outlineType,
    timesPerWeek: proposal.timesPerWeek ?? null,
    finishingDate: proposal.finishingDate ?? null,
    activities: Array.isArray(proposal.activities) ? proposal.activities : [],
    milestones: Array.isArray(proposal.milestones) ? proposal.milestones : [],
    sessions,
  };
}

function parseProposalDateTime(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? `${trimmed}T00:00:00.000Z`
    : trimmed;
  const date = new Date(normalized);

  return Number.isNaN(date.getTime()) ? null : date;
}

function buildPlanCreationDiffs(originalProposal: any, requestedProposal: any) {
  const fields = [
    { key: "goal", label: "Goal" },
    { key: "goalReason", label: "Why" },
    { key: "notes", label: "Notes" },
    { key: "emoji", label: "Emoji" },
    { key: "outlineType", label: "Plan type" },
    { key: "timesPerWeek", label: "Frequency" },
    { key: "finishingDate", label: "Finishing date" },
    { key: "activities", label: "Activities" },
    { key: "milestones", label: "Milestones" },
    { key: "sessions", label: "Sessions" },
  ];

  return fields.flatMap(({ key, label }) => {
    const oldValue = (originalProposal as any)[key];
    const newValue = (requestedProposal as any)[key];
    if (JSON.stringify(oldValue ?? null) === JSON.stringify(newValue ?? null)) {
      return [];
    }
    return [
      {
        label,
        oldValue: formatPlanCreationValue(key, oldValue),
        newValue: formatPlanCreationValue(key, newValue),
      },
    ];
  });
}

function hasPendingCoachActions(metadata: unknown): boolean {
  const data = metadata as any;
  const planProposals = Array.isArray(data?.planProposals) ? data.planProposals : [];
  const activityLogProposals = Array.isArray(data?.activityLogProposals)
    ? data.activityLogProposals
    : [];
  const activityEditProposals = Array.isArray(data?.activityEditProposals)
    ? data.activityEditProposals
    : [];
  const planCreationProposals = Array.isArray(data?.planCreationProposals)
    ? data.planCreationProposals
    : [];

  return [...planProposals, ...activityLogProposals, ...activityEditProposals, ...planCreationProposals].some(
    (proposal) => !proposal.status
  ) || (data?.metricReplacement && !data.metricReplacement.status);
}

async function concludeResolvedAutonomousCoachNotifications(
  userId: string,
  chatId: string,
  messageId: string
) {
  const notifications = await prisma.notification.findMany({
    where: {
      userId,
      type: "COACH",
      promptTag: AUTONOMOUS_COACH_PROMPT_TAG,
      relatedId: chatId,
      status: { not: "CONCLUDED" },
    },
  });

  const matchingNotifications = notifications.filter((notification) => {
    const relatedData = notification.relatedData as any;
    return Array.isArray(relatedData?.messageIds) && relatedData.messageIds.includes(messageId);
  });

  for (const notification of matchingNotifications) {
    const relatedData = notification.relatedData as any;
    const messageIds = relatedData.messageIds.filter((id: unknown) => typeof id === "string");
    const messages = await prisma.message.findMany({
      where: { id: { in: messageIds } },
      select: { metadata: true },
    });
    const hasPendingActions = messages.some((message) =>
      hasPendingCoachActions(message.metadata)
    );

    if (!hasPendingActions) {
      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: "CONCLUDED",
          concludedAt: new Date(),
        },
      });
      logger.info(
        `Concluded autonomous coach notification ${notification.id} after pending actions were resolved`
      );
    }
  }
}

router.post(
  "/coach/run-assessment",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const user = req.user!;
      const result = await coachAssessmentService.runManualCoachAssessmentForUser(user.id);

      if (result.action === "skipped") {
        return res.status(409).json({ error: result.reason, result });
      }

      if (result.action === "error") {
        return res.status(500).json({ error: result.reason, result });
      }

      res.json({ result });
    } catch (error) {
      logger.error("Error running manual coach assessment:", error);
      res.status(500).json({ error: "Failed to run coach assessment" });
    }
  }
);

router.get(
  "/coach/attention",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const user = req.user!;
      const now = new Date();
      const plans = await prisma.plan.findMany({
        where: {
          userId: user.id,
          ...activePlanWhere(now),
        },
        include: { activities: true, sessions: true, milestones: true },
        orderBy: [{ createdAt: "desc" }],
      });

      res.json({
        attentionItems: deriveCoachAttentionItems({
          user,
          plans,
          now,
        }),
      });
    } catch (error) {
      logger.error("Error loading coach attention items:", error);
      res.status(500).json({ error: "Failed to load coach attention items" });
    }
  }
);

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
              planCreationProposals: metadata.planCreationProposals || [],
              activityLogProposals: metadata.activityLogProposals || [],
              activityEditProposals: metadata.activityEditProposals || [],
              coachAttentionItems: metadata.coachAttentionItems || [],
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
                planCreationProposals: parsed.planCreationProposals || [],
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
      const coachPersonality = getCoachPersonalityConfig(user.coachPersonality);
      let coach = await prisma.coach.findFirst({
        where: { ownerId: user.id },
      });

      if (!coach) {
        coach = await prisma.coach.create({
          data: {
            ownerId: user.id,
            details: {
              name: coachPersonality.displayName,
              bio: `Your personal AI coach helping you achieve your goals as ${coachPersonality.title}.`,
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

// Clear only supermemory (keeps chat history)
router.delete(
  "/coach/memory",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const user = req.user!;

      await supermemoryService.deleteAllMemories(user.id);

      logger.info(`Cleared coach memory for user ${user.username}`);

      res.json({ success: true });
    } catch (error) {
      logger.error("Error clearing coach memory:", error);
      res.status(500).json({ error: "Failed to clear coach memory" });
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
          archivedAt: null,
          isPaused: false,
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

      const conversationHistory = toCoachConversationHistory(history);

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
      await concludeResolvedAutonomousCoachNotifications(
        user.id,
        message.chatId,
        messageId
      );

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
      await concludeResolvedAutonomousCoachNotifications(
        user.id,
        message.chatId,
        messageId
      );

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
      });

      if (!plan) {
        res.status(404).json({ error: "Plan not found" });
        return;
      }

      const patch = getProposalPatch(proposal);
      const { changes } = await executePlanProposalPatch({
        planId: proposal.planId,
        userId: user.id,
        patch,
      });

      // Update proposal status in metadata
      metadata.planProposals[proposalIndex].status = "accepted";
      await prisma.message.update({
        where: { id: messageId },
        data: { metadata },
      });
      await concludeResolvedAutonomousCoachNotifications(
        user.id,
        message.chatId,
        messageId
      );

      const successCount = changes.filter((c) => c.success).length;
      logger.info(
        `User ${user.username} accepted proposal: "${proposal.description}" (${successCount} changes successful)`
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
      await concludeResolvedAutonomousCoachNotifications(
        user.id,
        message.chatId,
        messageId
      );

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

// Accept a plan creation proposal from AI coach
router.post(
  "/messages/:messageId/accept-plan-creation-proposal",
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
        !metadata?.planCreationProposals ||
        !metadata.planCreationProposals[proposalIndex]
      ) {
        res.status(400).json({ error: "Plan creation proposal not found" });
        return;
      }

      const proposal = metadata.planCreationProposals[proposalIndex];

      if (proposal.status) {
        res.status(400).json({
          error: `Proposal already ${proposal.status}`,
        });
        return;
      }

      const requestedActivityIds: string[] = Array.from(
        new Set<string>(
          (proposal.activities || [])
            .map((activity: any) => activity.activityId)
            .filter(
              (activityId: unknown): activityId is string =>
                typeof activityId === "string" && activityId.length > 0
            )
        )
      );
      const existingActivitiesById = requestedActivityIds.length > 0
        ? new Map(
            (
              await prisma.activity.findMany({
                where: {
                  id: { in: requestedActivityIds },
                  userId: user.id,
                  deletedAt: null,
                },
              })
            ).map((activity) => [activity.id, activity])
          )
        : new Map();
      const missingActivityId = requestedActivityIds.find(
        (activityId) => !existingActivitiesById.has(activityId)
      );
      if (missingActivityId) {
        res.status(400).json({ error: `Activity ${missingActivityId} not found` });
        return;
      }

      const plan = await prisma.$transaction(async (tx) => {
        const activityIds: string[] = [];
        const activityIdsByTitle = new Map<string, string>();
        for (const activity of proposal.activities || []) {
          const existingById = activity.activityId
            ? existingActivitiesById.get(activity.activityId)
            : null;
          const existing =
            existingById ||
            (await tx.activity.findFirst({
              where: {
                userId: user.id,
                deletedAt: null,
                title: { equals: activity.title, mode: "insensitive" },
              },
            }));

          const savedActivity = existing || await tx.activity.create({
            data: {
              userId: user.id,
              title: activity.title,
              measure: activity.measure || "sessions",
              emoji: activity.emoji || "📋",
              kind: activity.kind || "other",
            },
          });
          if (!activityIds.includes(savedActivity.id)) {
            activityIds.push(savedActivity.id);
          }
          activityIdsByTitle.set(activity.title.toLowerCase(), savedActivity.id);
          activityIdsByTitle.set(savedActivity.title.toLowerCase(), savedActivity.id);
        }

        const sessionCreates: Array<{
          activityId: string;
          date: Date;
          quantity: number;
          descriptiveGuide: string;
        }> = [];

        for (const session of proposal.sessions || []) {
          let activityId = activityIdsByTitle.get(
            String(session.activityTitle || "").toLowerCase()
          );

          if (!activityId && session.activityTitle) {
            const existing = await tx.activity.findFirst({
              where: {
                userId: user.id,
                deletedAt: null,
                title: { equals: session.activityTitle, mode: "insensitive" },
              },
            });

            const savedActivity = existing || await tx.activity.create({
              data: {
                userId: user.id,
                title: session.activityTitle,
                measure: "sessions",
                emoji: "📋",
                kind: "other",
              },
            });

            activityId = savedActivity.id;
            if (!activityIds.includes(activityId)) {
              activityIds.push(activityId);
            }
            activityIdsByTitle.set(session.activityTitle.toLowerCase(), activityId);
          }

          const sessionDate = parseProposalDateTime(session.date);
          if (activityId && sessionDate) {
            sessionCreates.push({
              activityId,
              date: sessionDate,
              quantity: session.quantity || 1,
              descriptiveGuide: session.descriptiveGuide || "",
            });
          }
        }

        const milestoneCreates = (proposal.milestones || [])
          .flatMap((milestone: any) => {
            const milestoneDate = parseProposalDateTime(milestone.date);

            if (!milestone.description || !milestoneDate) {
              return [];
            }

            return [
              {
                description: milestone.description,
                date: milestoneDate,
                criteria: milestone.criteria || undefined,
                progress: milestone.progress ?? 0,
              },
            ];
          });

        const outlineType =
          sessionCreates.length > 0 || !proposal.timesPerWeek
            ? proposal.outlineType || "SPECIFIC"
            : "TIMES_PER_WEEK";

        const newPlan = await tx.plan.create({
          data: {
            userId: user.id,
            goal: proposal.goal,
            goalReason: proposal.goalReason || null,
            notes: proposal.notes || null,
            emoji: proposal.emoji || "🎯",
            finishingDate: parseProposalDateTime(proposal.finishingDate),
            outlineType,
            timesPerWeek:
              outlineType === "TIMES_PER_WEEK"
                ? proposal.timesPerWeek || null
                : null,
            activities: activityIds.length > 0
              ? { connect: activityIds.map((id) => ({ id })) }
              : undefined,
            sessions: sessionCreates.length > 0
              ? { create: sessionCreates }
              : undefined,
            milestones: milestoneCreates.length > 0
              ? { create: milestoneCreates }
              : undefined,
          },
          include: { activities: true, sessions: true, milestones: true },
        });

        return newPlan;
      });

      metadata.planCreationProposals[proposalIndex].status = "accepted";
      metadata.planCreationProposals[proposalIndex].planId = plan.id;
      await prisma.message.update({
        where: { id: messageId },
        data: { metadata },
      });
      await concludeResolvedAutonomousCoachNotifications(
        user.id,
        message.chatId,
        messageId
      );

      logger.info(
        `User ${user.username} accepted plan creation proposal: "${proposal.goal}"`
      );

      res.json({ success: true, plan });
    } catch (error) {
      logger.error("Error accepting plan creation proposal:", error);
      res.status(500).json({ error: "Failed to accept plan creation proposal" });
    }
  }
);

// Reject a plan creation proposal from AI coach
router.post(
  "/messages/:messageId/reject-plan-creation-proposal",
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
        !metadata?.planCreationProposals ||
        !metadata.planCreationProposals[proposalIndex]
      ) {
        res.status(400).json({ error: "Plan creation proposal not found" });
        return;
      }

      if (metadata.planCreationProposals[proposalIndex].status) {
        res.status(400).json({
          error: `Proposal already ${metadata.planCreationProposals[proposalIndex].status}`,
        });
        return;
      }

      metadata.planCreationProposals[proposalIndex].status = "rejected";
      await prisma.message.update({
        where: { id: messageId },
        data: { metadata },
      });
      await concludeResolvedAutonomousCoachNotifications(
        user.id,
        message.chatId,
        messageId
      );

      logger.info(
        `User ${user.username} rejected plan creation proposal: "${metadata.planCreationProposals[proposalIndex].goal}"`
      );

      res.json({ success: true });
    } catch (error) {
      logger.error("Error rejecting plan creation proposal:", error);
      res.status(500).json({ error: "Failed to reject plan creation proposal" });
    }
  }
);

router.post(
  "/messages/:messageId/propose-plan-creation-changes",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
      const { messageId } = req.params;
      const parsed = planCreationProposalChangesSchema.safeParse(req.body);

      if (!parsed.success) {
        res.status(400).json({ error: "Invalid plan creation change request" });
        return;
      }

      const { proposalIndex, requestedProposal: requestedPatch, note } = parsed.data;

      const message = await prisma.message.findUnique({
        where: { id: messageId },
        include: { chat: true },
      });

      if (!message) {
        res.status(404).json({ error: "Message not found" });
        return;
      }

      if (message.chat.userId !== user.id || message.chat.type !== "COACH") {
        res.status(403).json({ error: "Unauthorized" });
        return;
      }

      const metadata = message.metadata as any;
      if (
        !metadata?.planCreationProposals ||
        !metadata.planCreationProposals[proposalIndex]
      ) {
        res.status(400).json({ error: "Plan creation proposal not found" });
        return;
      }

      const proposal = metadata.planCreationProposals[proposalIndex];
      if (proposal.status) {
        res.status(400).json({
          error: `Proposal already ${proposal.status}`,
        });
        return;
      }

      const originalProposal = normalizePlanCreationProposal(proposal);
      const requestedProposal = normalizePlanCreationProposal({
        ...proposal,
        ...requestedPatch,
        activities: requestedPatch.activities ?? proposal.activities,
        milestones: requestedPatch.milestones ?? proposal.milestones,
        sessions: requestedPatch.sessions ?? proposal.sessions,
      });
      const diffs = buildPlanCreationDiffs(originalProposal, requestedProposal);

      metadata.planCreationProposals[proposalIndex].status = "changes_requested";
      await prisma.message.update({
        where: { id: messageId },
        data: { metadata },
      });

      const history = await prisma.message.findMany({
        where: { chatId: message.chatId },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
      history.reverse();

      const actionTitle = "User proposed changes on plan";
      const userActionMessage = await prisma.message.create({
        data: {
          chatId: message.chatId,
          role: "USER",
          content: actionTitle,
          senderId: user.id,
          metadata: {
            userAction: {
              type: "PLAN_CREATION_CHANGES_PROPOSED",
              title: actionTitle,
              originalProposal,
              requestedProposal,
              diffs,
              note: note?.trim() || null,
              proposalMessageId: messageId,
              proposalIndex,
            },
          },
        },
      });

      const plans = await prisma.plan.findMany({
        where: {
          userId: user.id,
          deletedAt: null,
          archivedAt: null,
          isPaused: false,
          OR: [{ finishingDate: null }, { finishingDate: { gt: new Date() } }],
        },
        include: {
          activities: true,
          sessions: true,
          milestones: true,
        },
        orderBy: [{ createdAt: "desc" }],
      });

      const reminders = await prisma.reminder.findMany({
        where: {
          userId: user.id,
          status: "PENDING",
        },
        orderBy: { triggerAt: "asc" },
      });

      const internalPrompt = [
        "The user proposed changes to a pending plan creation proposal.",
        "This is a structured UI action, not a normal chat message. Review the requested version and respond briefly.",
        "If the requested version is good, use proposePlanCreation to send back an updated plan creation proposal matching it.",
        "If you disagree, explain what you would change and optionally send a better proposal.",
        "",
        `Original proposal:\n${JSON.stringify(originalProposal, null, 2)}`,
        "",
        `Requested proposal:\n${JSON.stringify(requestedProposal, null, 2)}`,
        diffs.length > 0
          ? `\nChanged fields:\n${diffs
              .map((diff) => `- ${diff.label}: ${diff.oldValue} -> ${diff.newValue}`)
              .join("\n")}`
          : "\nChanged fields: none",
        note?.trim() ? `\nUser note:\n${note.trim()}` : "",
      ].join("\n");

      const conversationHistory = toCoachConversationHistory(history);

      const memoriesContext = await supermemoryService.getProfile(
        user.id,
        internalPrompt
      );

      const aiResponse = await coachAgentService.generateResponse({
        user,
        message: internalPrompt,
        conversationHistory,
        plans,
        reminders,
        memoriesContext,
      });

      type DraftType = (typeof aiResponse.draftMessages)[number];
      const savedMessages: Array<{
        coachMsg: Awaited<ReturnType<typeof prisma.message.create>>;
        draft: DraftType;
      }> = [];
      const hasNewPlanCreationProposal = aiResponse.draftMessages.some(
        (draft) => (draft.planCreationProposals?.length || 0) > 0
      );

      for (const draft of aiResponse.draftMessages) {
        const coachMsg = await prisma.message.create({
          data: {
            chatId: message.chatId,
            role: "COACH",
            content: draft.content,
            metadata: {
              planReplacements: draft.planReplacements || [],
              planProposals: JSON.parse(JSON.stringify(draft.planProposals || [])),
              planCreationProposals: JSON.parse(
                JSON.stringify(draft.planCreationProposals || [])
              ),
              activityLogProposals: JSON.parse(
                JSON.stringify(draft.activityLogProposals || [])
              ),
              activityEditProposals: JSON.parse(
                JSON.stringify(draft.activityEditProposals || [])
              ),
              ...(draft.toolCalls && {
                toolCalls: JSON.parse(JSON.stringify(draft.toolCalls)),
              }),
              ...(draft.error && { error: true }),
            },
          },
        });
        savedMessages.push({ coachMsg, draft });
      }

      if (hasNewPlanCreationProposal) {
        await cancelPendingPlanCreationProposals(
          message.chatId,
          savedMessages.map(({ coachMsg }) => coachMsg.id)
        );
      }

      await prisma.chat.update({
        where: { id: message.chatId },
        data: { updatedAt: new Date() },
      });

      const fullCoachText = aiResponse.draftMessages
        .map((draft) => draft.content)
        .join("\n");
      supermemoryService.addMemory(
        user.id,
        `user: ${internalPrompt}\nassistant: ${fullCoachText}`,
        savedMessages[savedMessages.length - 1]?.coachMsg.id || userActionMessage.id
      );

      const resolvedMessages = savedMessages.map(({ coachMsg, draft }) => {
        const resolvedPlanReplacements =
          draft.planReplacements
            ?.map((replacement) => {
              const plan = plans.find(
                (p) => p.goal.toLowerCase() === replacement.planGoal.toLowerCase()
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

        return {
          id: coachMsg.id,
          chatId: coachMsg.chatId,
          role: coachMsg.role,
          content: draft.content,
          planReplacements: resolvedPlanReplacements,
          planProposals: draft.planProposals || [],
          planCreationProposals: draft.planCreationProposals || [],
          activityLogProposals: draft.activityLogProposals || [],
          activityEditProposals: draft.activityEditProposals || [],
          toolCalls: draft.toolCalls || null,
          error: draft.error || false,
          createdAt: coachMsg.createdAt,
        };
      });

      const serializedUserActionMessage = {
        id: userActionMessage.id,
        chatId: userActionMessage.chatId,
        role: userActionMessage.role,
        content: userActionMessage.content,
        userAction: (userActionMessage.metadata as any)?.userAction,
        createdAt: userActionMessage.createdAt,
        senderId: user.id,
        senderName: user.name,
        senderPicture: user.picture,
      };

      logger.info(
        `User ${user.username} proposed changes to plan creation proposal: "${proposal.goal}"`
      );

      res.json({
        messages: [serializedUserActionMessage, ...resolvedMessages],
        message: resolvedMessages[resolvedMessages.length - 1] || serializedUserActionMessage,
      });
    } catch (error) {
      logger.error("Error proposing plan creation changes:", error);
      res.status(500).json({ error: "Failed to propose plan creation changes" });
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
      const description = normalizeOptionalText(proposal.description);
      const privateNotes = normalizeOptionalText(proposal.privateNotes);
      const difficulty =
        typeof proposal.difficulty === "string" ? proposal.difficulty : undefined;
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
            description:
              description !== undefined ? description : existingEntry.description,
            privateNotes:
              privateNotes !== undefined ? privateNotes : existingEntry.privateNotes,
            difficulty:
              difficulty !== undefined ? difficulty : existingEntry.difficulty,
          },
        });
      } else {
        await prisma.activityEntry.create({
          data: {
            activityId: proposal.activityId,
            userId: user.id,
            quantity: proposal.quantity,
            datetime: proposalDatetime,
            description,
            privateNotes,
            difficulty,
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

// Accept an activity edit proposal from AI coach
router.post(
  "/messages/:messageId/accept-activity-edit-proposal",
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
        !metadata?.activityEditProposals ||
        !metadata.activityEditProposals[proposalIndex]
      ) {
        res.status(400).json({ error: "Proposal not found" });
        return;
      }

      const proposal = metadata.activityEditProposals[proposalIndex];

      if (proposal.status) {
        res.status(400).json({
          error: `Proposal already ${proposal.status}`,
        });
        return;
      }

      const activity = await prisma.activity.findFirst({
        where: {
          id: proposal.activityId,
          userId: user.id,
          deletedAt: null,
        },
      });

      if (!activity) {
        res.status(404).json({ error: "Activity not found" });
        return;
      }

      const updatedActivity = await updateActivityWithMeasureConversion({
        prisma,
        userId: user.id,
        activityId: proposal.activityId,
        title: proposal.requested.title,
        measure: proposal.requested.measure,
        emoji: proposal.requested.emoji,
        colorHex: proposal.requested.colorHex,
        kind: proposal.requested.kind,
        measureConversion: proposal.measureConversion,
      });

      metadata.activityEditProposals[proposalIndex].status = "accepted";
      await prisma.message.update({
        where: { id: messageId },
        data: { metadata },
      });
      await concludeResolvedAutonomousCoachNotifications(
        user.id,
        message.chatId,
        messageId
      );

      logger.info(
        `User ${user.username} accepted activity edit proposal: ${proposal.activityName}`
      );

      res.json({ success: true, activity: updatedActivity });
    } catch (error) {
      logger.error("Error accepting activity edit proposal:", error);
      const message =
        error instanceof Error ? error.message : "Failed to accept activity edit proposal";
      const isConversionError =
        message.includes("conversion") || message.includes("whole numbers");
      res.status(isConversionError ? 400 : 500).json({ error: message });
    }
  }
);

// Reject an activity edit proposal from AI coach
router.post(
  "/messages/:messageId/reject-activity-edit-proposal",
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
        !metadata?.activityEditProposals ||
        !metadata.activityEditProposals[proposalIndex]
      ) {
        res.status(400).json({ error: "Proposal not found" });
        return;
      }

      if (metadata.activityEditProposals[proposalIndex].status) {
        res.status(400).json({
          error: `Proposal already ${metadata.activityEditProposals[proposalIndex].status}`,
        });
        return;
      }

      metadata.activityEditProposals[proposalIndex].status = "rejected";
      await prisma.message.update({
        where: { id: messageId },
        data: { metadata },
      });
      await concludeResolvedAutonomousCoachNotifications(
        user.id,
        message.chatId,
        messageId
      );

      logger.info(
        `User ${user.username} rejected activity edit proposal: ${metadata.activityEditProposals[proposalIndex].activityName}`
      );

      res.json({ success: true });
    } catch (error) {
      logger.error("Error rejecting activity edit proposal:", error);
      res.status(500).json({ error: "Failed to reject activity edit proposal" });
    }
  }
);

// Accept a user context event proposal from AI coach
router.post(
  "/messages/:messageId/accept-user-context-event-proposal",
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
        !metadata?.userContextEventProposals ||
        !metadata.userContextEventProposals[proposalIndex]
      ) {
        res.status(400).json({ error: "Proposal not found" });
        return;
      }

      const proposal = metadata.userContextEventProposals[proposalIndex];

      if (proposal.status) {
        res.status(400).json({
          error: `Proposal already ${proposal.status}`,
        });
        return;
      }

      if (typeof proposal.title !== "string" || !proposal.title.trim()) {
        res.status(400).json({ error: "Proposal title is required" });
        return;
      }

      const parseOptionalDate = (value: unknown): Date | null => {
        if (typeof value !== "string" || !value.trim()) return null;
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
      };

      const event = await prisma.userContextEvent.create({
        data: {
          userId: user.id,
          title: proposal.title.trim().slice(0, 120),
          description: normalizeOptionalText(proposal.description) ?? null,
          occurredAt: parseOptionalDate(proposal.occurredAt),
          endedAt: parseOptionalDate(proposal.endedAt),
          source: "USER_CONFIRMED",
          sourceMessageId: messageId,
          confidence:
            typeof proposal.confidence === "number"
              ? Math.max(0, Math.min(1, proposal.confidence))
              : null,
        },
      });

      metadata.userContextEventProposals[proposalIndex].status = "accepted";
      metadata.userContextEventProposals[proposalIndex].contextEventId = event.id;
      await prisma.message.update({
        where: { id: messageId },
        data: { metadata },
      });

      logger.info(
        `User ${user.username} accepted user context event proposal: ${event.title}`
      );

      res.json({ success: true, event });
    } catch (error) {
      logger.error("Error accepting user context event proposal:", error);
      res.status(500).json({ error: "Failed to accept user context event proposal" });
    }
  }
);

// Reject a user context event proposal from AI coach
router.post(
  "/messages/:messageId/reject-user-context-event-proposal",
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
        !metadata?.userContextEventProposals ||
        !metadata.userContextEventProposals[proposalIndex]
      ) {
        res.status(400).json({ error: "Proposal not found" });
        return;
      }

      if (metadata.userContextEventProposals[proposalIndex].status) {
        res.status(400).json({
          error: `Proposal already ${metadata.userContextEventProposals[proposalIndex].status}`,
        });
        return;
      }

      metadata.userContextEventProposals[proposalIndex].status = "rejected";
      await prisma.message.update({
        where: { id: messageId },
        data: { metadata },
      });

      logger.info(
        `User ${user.username} rejected user context event proposal: ${metadata.userContextEventProposals[proposalIndex].title}`
      );

      res.json({ success: true });
    } catch (error) {
      logger.error("Error rejecting user context event proposal:", error);
      res.status(500).json({ error: "Failed to reject user context event proposal" });
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
      const coachPersonality = getCoachPersonalityConfig(user.coachPersonality);
      let coach = await prisma.coach.findFirst({
        where: { ownerId: user.id },
      });

      if (!coach) {
        coach = await prisma.coach.create({
          data: {
            ownerId: user.id,
            details: {
              name: coachPersonality.displayName,
              bio: `Your personal AI coach helping you achieve your goals as ${coachPersonality.title}.`,
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
          archivedAt: null,
          isPaused: false,
          OR: [
            { finishingDate: null },
            { finishingDate: { gt: new Date() } },
          ],
        },
        include: {
          activities: true,
          sessions: true,
          milestones: true,
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
          "If a plan or activity appears missed, also use readActivities for the past 90 days before deciding what to suggest. " +
          "Highlight what went well and what was missed. Treat sustained absence seriously: if a plan has no meaningful activity for 30+ days, prefer proposePlanModification with patch.archive instead of reducing frequency by one. " +
          "For short-term misses, suggest a concrete lower-friction patch with proposePlanModification, such as removing upcoming sessions or adjusting quantities. " +
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
      const hasNewPlanCreationProposal = aiResponse.draftMessages.some(
        (draft) => (draft.planCreationProposals?.length || 0) > 0
      );
      for (const draft of aiResponse.draftMessages) {
        const coachMsg = await prisma.message.create({
          data: {
            chatId: chat.id,
            role: "COACH",
            content: draft.content,
            metadata: {
              planReplacements: draft.planReplacements || [],
              planProposals: JSON.parse(JSON.stringify(draft.planProposals || [])),
              planCreationProposals: JSON.parse(JSON.stringify(draft.planCreationProposals || [])),
              notificationType: type,
              ...(draft.toolCalls && {
                toolCalls: JSON.parse(JSON.stringify(draft.toolCalls)),
              }),
            },
          },
        });
        savedMessages.push({ coachMsg, draft });
      }

      if (hasNewPlanCreationProposal) {
        await cancelPendingPlanCreationProposals(
          chat.id,
          savedMessages.map(({ coachMsg }) => coachMsg.id)
        );
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
        planCreationProposals: draft.planCreationProposals || [],
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
