import { Router, Request, Response } from "express";
import multer from "multer";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import { logger } from "../utils/logger";
import { prisma } from "../utils/prisma";
import { notificationService } from "../services/notificationService";
import { sttService } from "../services/sttService";
import { aiService } from "../services/aiService";
import { memoryService } from "../services/memoryService";
import { TelegramService } from "../services/telegramService";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });
const telegramService = new TelegramService();

// Audio transcription endpoint
router.post(
  "/transcribe",
  requireAuth,
  upload.single("audio_file"),
  async (req: AuthenticatedRequest, res: Response) => {
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

// Generate coach message endpoint
router.post(
  "/generate-coach-message",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;

      if (user.planType !== "PLUS") {
        return res.status(401).json({ error: "You're on free plan." });
      }

      // TODO: Check if user has plans when plans system is implemented
      // For now, return placeholder
      logger.info(`Coach message generation requested for user ${user.id}`);

      const message =
        "AI coaching feature coming soon! Your personalized coaching messages will appear here once the AI system is fully implemented.";

      // Create a notification for the user
      await notificationService.createAndProcessNotification({
        userId: user.id,
        message,
        type: "INFO",
        relatedData: {
          picture:
            "https://alramalhosandbox.s3.eu-west-1.amazonaws.com/tracking_software/jarvis_logo_transparent.png",
        },
      });

      res.json({ message });
    } catch (error) {
      logger.error("Error generating coach message:", error);
      res.status(500).json({ error: "Failed to generate coach message" });
    }
  }
);

// Daily checkin extractions endpoint
router.post(
  "/get-daily-checkin-extractions",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { ai_message, message, question_checks } = req.body;

      if (!message || !question_checks) {
        return res
          .status(400)
          .json({ error: "message and question_checks are required" });
      }

      logger.info(
        `Daily checkin extraction requested for user ${req.user!.id}`
      );

      // Store AI and user messages in memory for context
      if (ai_message) {
        await memoryService.writeMessage(req.user!.id, {
          text: ai_message,
          senderName: "Jarvis",
          senderId: "0",
          recipientName: req.user!.name || req.user!.username || "User",
          recipientId: req.user!.id,
        });
      }

      await memoryService.writeMessage(req.user!.id, {
        text: message,
        senderName: req.user!.name || req.user!.username || "User",
        senderId: req.user!.id,
        recipientName: "Jarvis",
        recipientId: "0",
      });

      // Get user context for better AI analysis
      const userProfile =
        req.user!.profile || `User with username ${req.user!.username}`;

      // Run AI extractions in parallel
      const [
        activityResult,
        metricResult,
        questionAnalysis,
        motivationalMessage,
      ] = await Promise.all([
        aiService.extractActivities(message, userProfile),
        aiService.extractMetrics(message, userProfile),
        aiService.analyzeQuestionCoverage(message, question_checks),
        aiService.generateMotivationalMessage(
          userProfile,
          `Daily check-in: ${message}`
        ),
      ]);

      const response = {
        question_checks: questionAnalysis.results,
        message: motivationalMessage,
        metric_entries: metricResult.metrics.map((metric) => ({
          id: `temp_${Date.now()}_${Math.random()}`,
          metric_id: metric.metric_id || null,
          rating: metric.rating,
          date: metric.date,
          notes: metric.notes,
        })),
        activity_entries: activityResult.activities.map((activity) => ({
          id: `temp_${Date.now()}_${Math.random()}`,
          activityId: activity.activityId || null,
          quantity: activity.quantity,
          date: activity.date,
          description: activity.description,
          title: activity.title,
          measure: activity.measure,
        })),
        response: `AI extracted ${activityResult.activities.length} activities and ${metricResult.metrics.length} metrics with confidence scores.`,
      };

      res.json(response);
    } catch (error) {
      logger.error("Error in daily checkin extractions:", error);
      res
        .status(500)
        .json({ error: "Failed to process daily checkin extractions" });
    }
  }
);

// Past week logging extractions endpoint
router.post(
  "/get-past-week-logging-extractions",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { ai_message, message, question_checks } = req.body;

      if (!message || !question_checks) {
        return res
          .status(400)
          .json({ error: "message and question_checks are required" });
      }

      logger.info(
        `Past week logging extraction requested for user ${req.user!.id}`
      );

      // Store AI and user messages in memory for context
      await memoryService.writeMessage(req.user!.id, {
        text: ai_message,
        senderName: "Jarvis",
        senderId: "0",
        recipientName: req.user!.name || req.user!.username || "User",
        recipientId: req.user!.id,
      });

      await memoryService.writeMessage(req.user!.id, {
        text: message,
        senderName: req.user!.name || req.user!.username || "User",
        senderId: req.user!.id,
        recipientName: "Jarvis",
        recipientId: "0",
      });

      // Get user context for better AI analysis
      const userProfile =
        req.user!.profile || `User with username ${req.user!.username}`;
      const conversationHistory = await memoryService.readConversationHistory(
        req.user!.id,
        30
      );

      // Run AI extractions in parallel
      const [activityResult, questionAnalysis] = await Promise.all([
        aiService.extractActivities(message, userProfile),
        aiService.analyzeQuestionCoverage(
          conversationHistory || message,
          question_checks
        ),
      ]);

      // Store AI response message
      await memoryService.writeMessage(req.user!.id, {
        text: questionAnalysis.follow_up_message,
        senderName: "Jarvis",
        senderId: "0",
        recipientName: req.user!.name || req.user!.username || "User",
        recipientId: req.user!.id,
      });

      const response: any = {
        message: questionAnalysis.follow_up_message,
        question_checks: questionAnalysis.results,
      };

      if (activityResult.activities.length > 0) {
        response.activity_entries = activityResult.activities.map(
          (activity) => ({
            id: `temp_${Date.now()}_${Math.random()}`,
            activityId: activity.activityId || null,
            quantity: activity.quantity,
            date: activity.date,
            description: activity.description,
            title: activity.title,
            measure: activity.measure,
          })
        );
      }

      res.json(response);
    } catch (error) {
      logger.error("Error in past week logging extractions:", error);
      res
        .status(500)
        .json({ error: "Failed to process past week logging extractions" });
    }
  }
);

// Plan extractions endpoint
router.post(
  "/get-plan-extractions",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { message, question_checks } = req.body;

      if (!message || !question_checks) {
        return res
          .status(400)
          .json({ error: "message and question_checks are required" });
      }

      logger.info(`Plan extraction requested for user ${req.user!.id}`);

      // Store user message in memory for context
      await memoryService.writeMessage(req.user!.id, {
        text: message,
        senderName: req.user!.name || req.user!.username || "User",
        senderId: req.user!.id,
        recipientName: "Jarvis",
        recipientId: "0",
      });

      // Get conversation history for better context
      const conversationHistory = await memoryService.readConversationHistory(
        req.user!.id,
        30
      );
      const userProfile =
        req.user!.profile || `User with username ${req.user!.username}`;

      // Analyze question coverage first
      const questionAnalysis = await aiService.analyzeQuestionCoverage(
        conversationHistory || message,
        question_checks
      );

      const response: any = {
        question_checks: questionAnalysis.results,
      };

      if (!questionAnalysis.all_answered) {
        response.message = questionAnalysis.follow_up_message;
      } else {
        // Generate plan if all questions are answered - AI is aware of the plan it creates
        const planResult = await aiService.createPlanWithResponse(
          message,
          userProfile
        );

        // Store AI response in memory
        await memoryService.writeMessage(req.user!.id, {
          text: planResult.ai_response,
          senderName: "Jarvis",
          senderId: "0",
          recipientName: req.user!.name || req.user!.username || "User",
          recipientId: req.user!.id,
        });

        response.message = planResult.ai_response;
        response.plan = planResult.plan;
        response.activities = planResult.activities;
      }

      res.json(response);
    } catch (error) {
      logger.error("Error in plan extractions:", error);
      res.status(500).json({ error: "Failed to process plan extractions" });
    }
  }
);

// Update user profile from questions
router.post(
  "/update-user-profile-from-questions",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { question_checks, message } = req.body;

      if (!message || !question_checks) {
        return res
          .status(400)
          .json({ error: "message and question_checks are required" });
      }

      logger.info(
        `Profile update from questions requested for user ${req.user!.id}`
      );

      // Get current conversation context with history for better analysis
      const conversationHistory = await memoryService.readConversationHistory(
        req.user!.id,
        30
      );
      const fullConversation = conversationHistory
        ? `${conversationHistory}\n${req.user!.name || req.user!.username || "User"} (just now): ${message}`
        : `${req.user!.name || req.user!.username || "User"}: ${message}`;
      const questions = Object.keys(question_checks);

      // Run AI analysis in parallel
      const [profileAnalysis, questionAnalysis] = await Promise.all([
        aiService.analyzeUserProfile(fullConversation, questions),
        aiService.analyzeQuestionCoverage(fullConversation, question_checks),
      ]);

      // Update user profile in database
      const updates: any = {
        profile: profileAnalysis.profile,
      };

      if (profileAnalysis.age) {
        updates.age = profileAnalysis.age;
      }

      const updatedUser = await prisma.user.update({
        where: { id: req.user!.id },
        data: updates,
      });

      res.json({
        message: questionAnalysis.follow_up_message,
        user: updatedUser,
        question_checks: questionAnalysis.results,
        analysis: {
          interests: profileAnalysis.interests,
          goals: profileAnalysis.goals,
        },
      });
    } catch (error) {
      logger.error("Error updating user profile:", error);
      res.status(500).json({ error: "Failed to update user profile" });
    }
  }
);

// Rejection endpoints for feedback
router.post(
  "/reject-daily-checkin",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { message, activity_entries, metric_entries, rejection_feedback } =
        req.body;

      logger.info(
        `Daily checkin rejection feedback from user ${req.user!.username}: ${rejection_feedback}`
      );
      logger.debug("Message:", message);
      logger.debug("Activity entries:", activity_entries);
      logger.debug("Metric entries:", metric_entries);

      // Send to Telegram notification service
      telegramService.sendMessage(
        `🔄 **Daily checkin rejection feedback**\n\n` +
          `**User:** ${req.user!.username}\n` +
          `**Feedback:** ${rejection_feedback}\n` +
          `**Activity entries:** ${activity_entries?.length || 0}\n` +
          `**Metric entries:** ${metric_entries?.length || 0}\n` +
          `**UTC Time:** ${new Date().toISOString()}`
      );

      res.json({ status: "success" });
    } catch (error) {
      logger.error("Error handling daily checkin rejection:", error);
      res.status(500).json({ error: "Failed to process rejection feedback" });
    }
  }
);

router.post(
  "/reject-past-week-logging",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { feedback, user_message, ai_message } = req.body;

      logger.info(
        `Past week logging rejection feedback from user ${req.user!.username}: ${feedback}`
      );
      logger.debug("User message:", user_message);
      logger.debug("AI message:", ai_message);

      // Send to Telegram notification service
      telegramService.sendMessage(
        `🔄 **Past week logging rejection feedback**\n\n` +
          `**User:** ${req.user!.username}\n` +
          `**Feedback:** ${feedback}\n` +
          `**UTC Time:** ${new Date().toISOString()}`
      );

      res.json({ status: "success", message: "Feedback received" });
    } catch (error) {
      logger.error("Error handling past week logging rejection:", error);
      res.status(500).json({ error: "Failed to process rejection feedback" });
    }
  }
);

router.post(
  "/reject-plan",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { feedback, plan, user_message, ai_message } = req.body;

      logger.info(
        `Plan rejection feedback from user ${req.user!.username}: ${feedback}`
      );
      logger.debug("Plan:", plan);
      logger.debug("User message:", user_message);
      logger.debug("AI message:", ai_message);

      // Send to Telegram notification service
      telegramService.sendMessage(
        `🔄 **Plan rejection feedback**\n\n` +
          `**User:** ${req.user!.username}\n` +
          `**Feedback:** ${feedback}\n` +
          `**Plan goal:** ${plan?.goal || "N/A"}\n` +
          `**UTC Time:** ${new Date().toISOString()}`
      );

      res.json({ status: "success", message: "Feedback received" });
    } catch (error) {
      logger.error("Error handling plan rejection:", error);
      res.status(500).json({ error: "Failed to process rejection feedback" });
    }
  }
);

// Dynamic UI logging endpoints
router.post(
  "/log-dynamic-ui-attempt-error",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
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
          `⚠️ **Dynamic UI attempt error**\n\n` +
            `**User:** ${req.user!.username}\n` +
            `**Attempts:** ${attempts}\n` +
            `**ID:** ${id}\n` +
            `**UTC Time:** ${new Date().toISOString()}`
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
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { question_checks, attempts, extracted_data, id } = req.body;

      logger.info(
        `Dynamic UI skip logged for user ${req.user!.username}, attempts: ${attempts}, id: ${id}`
      );
      logger.debug("Question checks:", question_checks);
      logger.debug("Extracted data:", extracted_data);

      // Send to Telegram notification service for pattern analysis
      telegramService.sendMessage(
        `⏭️ **Dynamic UI skip**\n\n` +
          `**User:** ${req.user!.username}\n` +
          `**Attempts:** ${attempts}\n` +
          `**ID:** ${id}\n` +
          `**UTC Time:** ${new Date().toISOString()}`
      );

      res.json({ status: "success" });
    } catch (error) {
      logger.error("Error logging dynamic UI skip:", error);
      res.status(500).json({ error: "Failed to log skip" });
    }
  }
);

// Health check
router.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "ai-routes",
    note: "AI features with memory management and conversation context",
  });
});

export const aiRouter = router;
export default aiRouter;
