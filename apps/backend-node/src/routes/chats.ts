import { Response, Router } from "express";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth";
import { aiService } from "../services/aiService";
import { logger } from "../utils/logger";
import { prisma } from "../utils/prisma";

const router = Router();

// Get all chats for the current user (COACH, DIRECT, GROUP)
router.get(
  "/",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const user = req.user!;

      // Fetch all chats where user is involved
      const chats = await prisma.chat.findMany({
        where: {
          OR: [
            // Coach chats
            { userId: user.id, type: "COACH" },
            // Direct chats where user is a participant
            {
              type: "DIRECT",
              participants: {
                some: { userId: user.id },
              },
            },
            // Group chats where user is a participant
            {
              type: "GROUP",
              participants: {
                some: { userId: user.id },
              },
            },
          ],
        },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  username: true,
                  picture: true,
                },
              },
            },
          },
          planGroup: {
            select: {
              id: true,
            },
          },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              content: true,
              createdAt: true,
              role: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      });

      // Transform chats to include useful information
      const transformedChats = chats.map((chat) => {
        const lastMessage = chat.messages[0];

        return {
          id: chat.id,
          type: chat.type,
          title: chat.title,
          createdAt: chat.createdAt,
          updatedAt: chat.updatedAt,
          coachId: chat.coachId,
          planGroupId: chat.planGroupId,
          participants: chat.participants.map((p) => ({
            id: p.id,
            userId: p.user.id,
            name: p.user.name,
            username: p.user.username,
            picture: p.user.picture,
            joinedAt: p.joinedAt,
            leftAt: p.leftAt,
          })),
          lastMessage: lastMessage
            ? {
                content: lastMessage.content,
                createdAt: lastMessage.createdAt,
                // For group chats, we'd need to fetch sender name
                senderName:
                  lastMessage.role === "USER" ? user.name : "Coach Oli",
              }
            : undefined,
        };
      });

      logger.info(`Fetched ${chats.length} chats for user ${user.username}`);

      res.json({ chats: transformedChats });
    } catch (error) {
      logger.error("Error fetching chats:", error);
      res.status(500).json({ error: "Failed to fetch chats" });
    }
  }
);

// Get messages for a specific chat
router.get(
  "/:chatId/messages",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const user = req.user!;
      const { chatId } = req.params;

      // Verify user has access to this chat
      const chat = await prisma.chat.findFirst({
        where: {
          id: chatId,
          OR: [
            // User owns the coach chat
            { userId: user.id, type: "COACH" },
            // User is a participant
            {
              participants: {
                some: { userId: user.id },
              },
            },
          ],
        },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  username: true,
                  picture: true,
                },
              },
            },
          },
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

      // For coach chats, we need to parse and structure messages (same logic as ai.ts)
      if (chat.type === "COACH") {
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

        const stripEmojis = (text: string) => {
          return text
            .replace(
              /[\p{Emoji}\p{Emoji_Presentation}\p{Emoji_Modifier}\p{Emoji_Component}]/gu,
              ""
            )
            .trim();
        };

        const structuredMessages = messages.map((msg) => {
          if (msg.role === "COACH") {
            if (msg.metadata && typeof msg.metadata === "object") {
              const metadata = msg.metadata as any;

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

              let metricReplacement: any = null;
              if (metadata.metricReplacement) {
                const aiMetricTitle = stripEmojis(
                  metadata.metricReplacement.metricTitle
                ).toLowerCase();
                const metric = metrics.find(
                  (m: any) =>
                    stripEmojis(m.title).toLowerCase() === aiMetricTitle
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
                    status: metadata.metricReplacement.status || null,
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
                userRecommendations: metadata.userRecommendations || null,
                createdAt: msg.createdAt,
                feedback: msg.feedback,
              };
            }

            // Fallback for old format or parsing
            return {
              id: msg.id,
              chatId: msg.chatId,
              role: msg.role,
              content: msg.content,
              planReplacements: [],
              metricReplacement: null,
              createdAt: msg.createdAt,
              feedback: msg.feedback,
            };
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

        return res.json({ messages: structuredMessages });
      }

      // For DIRECT and GROUP chats, return messages with sender information
      const structuredMessages = messages.map((msg) => {
        // Find sender from participants if it's a user message
        const sender =
          msg.role === "USER"
            ? chat.participants.find((p) => p.userId === user.id)
            : null;

        return {
          id: msg.id,
          chatId: msg.chatId,
          role: msg.role,
          content: msg.content,
          createdAt: msg.createdAt,
          senderId: sender?.userId,
          senderName: sender?.user.name,
          senderPicture: sender?.user.picture,
        };
      });

      logger.info(
        `Fetched ${messages.length} messages for chat ${chatId}, user ${user.username}`
      );

      res.json({ messages: structuredMessages });
    } catch (error) {
      logger.error("Error fetching messages:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  }
);

// Send a message to any chat type
router.post(
  "/:chatId/messages",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const user = req.user!;
      const { chatId } = req.params;
      const { message } = req.body;

      if (!message || typeof message !== "string" || !message.trim()) {
        return res.status(400).json({ error: "Message is required" });
      }

      // Verify user has access to this chat
      const chat = await prisma.chat.findFirst({
        where: {
          id: chatId,
          OR: [
            { userId: user.id, type: "COACH" },
            {
              participants: {
                some: { userId: user.id },
              },
            },
          ],
        },
        include: {
          coach: true,
          participants: true,
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

      // Update chat's updatedAt timestamp
      await prisma.chat.update({
        where: { id: chatId },
        data: { updatedAt: new Date() },
      });

      // Handle different chat types
      if (chat.type === "COACH") {
        // Get conversation history
        const history = await prisma.message.findMany({
          where: { chatId: chatId },
          orderBy: { createdAt: "desc" },
          take: 20,
        });
        history.reverse();

        // Get user's plans and metrics
        const plans = await prisma.plan.findMany({
          where: {
            userId: user.id,
            deletedAt: null,
            OR: [
              { finishingDate: null },
              { finishingDate: { gt: new Date() } },
            ],
          },
          include: { activities: true },
          orderBy: [{ createdAt: "desc" }],
        });

        const metrics = await prisma.metric.findMany({
          where: { userId: user.id },
          orderBy: [{ createdAt: "desc" }],
        });

        const conversationHistory = history.map((msg) => ({
          role: msg.role === "USER" ? "user" : "assistant",
          content: msg.content,
        }));

        // Generate AI response
        const aiResponse = await aiService.generateCoachChatResponse({
          user: user,
          message: message,
          chatId: chatId,
          conversationHistory: conversationHistory,
          plans: plans,
          metrics: metrics,
        });

        // Save coach message
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
          `Coach chat - User: ${user.username}, Message: "${message.substring(0, 50)}..."`
        );

        // Generate chat title if this is the first exchange
        if (!chat.title) {
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

              await prisma.chat.update({
                where: { id: chatId },
                data: { title: generatedTitle.trim() },
              });

              logger.info(
                `Generated title for chat ${chatId}: "${generatedTitle}"`
              );
            } catch (error) {
              logger.error("Error generating chat title:", error);
            }
          })();
        }

        // Resolve plans and metrics for response
        const stripEmojis = (text: string) => {
          return text
            .replace(
              /[\p{Emoji}\p{Emoji_Presentation}\p{Emoji_Modifier}\p{Emoji_Component}]/gu,
              ""
            )
            .trim();
        };

        const resolvedPlanReplacements =
          aiResponse.planReplacements
            ?.map((replacement) => {
              const plan = plans.find(
                (p) =>
                  p.goal.toLowerCase() === replacement.planGoal.toLowerCase()
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
          }
        }

        return res.json({
          message: {
            id: coachMessage.id,
            chatId: coachMessage.chatId,
            role: coachMessage.role,
            content: aiResponse.messageContent,
            planReplacements: resolvedPlanReplacements,
            metricReplacement: resolvedMetricReplacement,
            userRecommendations: aiResponse.userRecommendations || null,
            createdAt: coachMessage.createdAt,
          },
        });
      }

      // For DIRECT and GROUP chats, just acknowledge the message
      // (no AI response needed)
      logger.info(
        `${chat.type} chat message - User: ${user.username}, Chat: ${chatId}`
      );

      res.json({
        message: {
          id: "user-message",
          chatId: chatId,
          role: "USER",
          content: message,
          createdAt: new Date(),
          senderId: user.id,
          senderName: user.name,
          senderPicture: user.picture,
        },
      });
    } catch (error) {
      logger.error("Error sending message:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  }
);

// Create a direct message chat with another user
router.post(
  "/direct",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const user = req.user!;
      const { userId: otherUserId } = req.body;

      if (!otherUserId || typeof otherUserId !== "string") {
        return res.status(400).json({ error: "userId is required" });
      }

      // Check if other user exists
      const otherUser = await prisma.user.findUnique({
        where: { id: otherUserId },
        select: {
          id: true,
          name: true,
          username: true,
          picture: true,
        },
      });

      if (!otherUser) {
        return res.status(404).json({ error: "User not found" });
      }

      // Check if a direct chat already exists between these users
      const existingChat = await prisma.chat.findFirst({
        where: {
          type: "DIRECT",
          AND: [
            {
              participants: {
                some: { userId: user.id },
              },
            },
            {
              participants: {
                some: { userId: otherUserId },
              },
            },
          ],
        },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  username: true,
                  picture: true,
                },
              },
            },
          },
        },
      });

      if (existingChat) {
        logger.info(
          `Returning existing direct chat ${existingChat.id} between ${user.username} and ${otherUser.username}`
        );

        return res.json({
          chat: {
            id: existingChat.id,
            type: existingChat.type,
            title: existingChat.title,
            createdAt: existingChat.createdAt,
            updatedAt: existingChat.updatedAt,
            participants: existingChat.participants.map((p) => ({
              id: p.id,
              userId: p.user.id,
              name: p.user.name,
              username: p.user.username,
              picture: p.user.picture,
              joinedAt: p.joinedAt,
              leftAt: p.leftAt,
            })),
          },
        });
      }

      // Create new direct chat
      const chat = await prisma.chat.create({
        data: {
          type: "DIRECT",
          participants: {
            create: [{ userId: user.id }, { userId: otherUserId }],
          },
        },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  username: true,
                  picture: true,
                },
              },
            },
          },
        },
      });

      logger.info(
        `Created direct chat ${chat.id} between ${user.username} and ${otherUser.username}`
      );

      res.json({
        chat: {
          id: chat.id,
          type: chat.type,
          title: chat.title,
          createdAt: chat.createdAt,
          updatedAt: chat.updatedAt,
          participants: chat.participants.map((p) => ({
            id: p.id,
            userId: p.user.id,
            name: p.user.name,
            username: p.user.username,
            picture: p.user.picture,
            joinedAt: p.joinedAt,
            leftAt: p.leftAt,
          })),
        },
      });
    } catch (error) {
      logger.error("Error creating direct chat:", error);
      res.status(500).json({ error: "Failed to create direct chat" });
    }
  }
);

export const chatsRouter: Router = router;
export default chatsRouter;
