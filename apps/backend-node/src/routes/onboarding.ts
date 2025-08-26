import { Activity } from "@tsw/prisma";
import { Response, Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth";
import { aiService } from "../services/aiService";
import { memoryService } from "../services/memoryService";
import { logger } from "../utils/logger";
import { prisma } from "../utils/prisma";

const router = Router();

// Check plan goal and validate completeness
router.post(
  "/check-plan-goal",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const { message, question_checks } = req.body;

      if (!message || !question_checks) {
        return res
          .status(400)
          .json({ error: "message and question_checks are required" });
      }

      logger.info(`Plan goal check for user ${req.user!.id}`);

      // Store user message in memory
      await memoryService.writeMessage({
        content: message,
        userId: req.user!.id,
        role: "USER",
      });

      // const conversationHistory = await memoryService.readConversationHistory(
      //   req.user!.id,
      //   30
      // );
      const conversationHistory = undefined;
      const fullConversation = conversationHistory
        ? `${conversationHistory}\n${req.user!.name || req.user!.username || "User"} (just now): ${message}`
        : `${req.user!.name || req.user!.username || "User"}: ${message}`;

      // Run parallel analysis
      const [questionAnalysis, goalParaphrase] = await Promise.all([
        aiService.analyzeQuestionCoverage(fullConversation, question_checks),
        aiService.paraphraseGoal(message),
      ]);

      const response: any = {
        question_checks: questionAnalysis.results,
      };

      if (!questionAnalysis.all_answered) {
        response.message = questionAnalysis.follow_up_message;
      } else {
        response.goal = goalParaphrase.goal;
        response.emoji = goalParaphrase.emoji;
      }

      res.json(response);
    } catch (error) {
      logger.error("Error checking plan goal:", error);
      res.status(500).json({ error: "Failed to check plan goal" });
    }
  }
);

// Generate plan activities based on user input
router.post(
  "/generate-plan-activities",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const { message, plan_goal } = req.body;

      if (message == null || plan_goal == undefined) {
        return res
          .status(400)
          .json({ error: "message and plan_goal are required" });
      }

      logger.info(`Generating plan activities for user ${req.user!.id}`);

      // Store user message in memory
      await memoryService.writeMessage({
        content: message,
        userId: req.user!.id,
        role: "USER",
      });

      const conversationHistory = await memoryService.readConversationHistory(
        req.user!.id,
        30
      );
      const userContext = `Plan goal: ${plan_goal}. User conversation: ${conversationHistory || message}`;

      // Extract activities using AI
      const activitiesResult = await aiService.extractActivitiesForPlan(
        message,
        userContext
      );

      // Create activities in database
      const createdActivities: Activity[] = [];
      for (const activity of activitiesResult.activities) {
        const existingActivity = await prisma.activity.findFirst({
          where: {
            userId: req.user!.id,
            title: {
              equals: activity.title,
              mode: "insensitive",
            },
          },
        });

        if (existingActivity) {
          createdActivities.push(existingActivity);
        } else {
          const newActivity = await prisma.activity.create({
            data: {
              userId: req.user!.id,
              title: activity.title,
              emoji: activity.emoji,
              measure: activity.measure,
            },
          });
          createdActivities.push(newActivity);
        }
      }

      res.json({
        question_checks: {},
        activities: createdActivities,
      });
    } catch (error) {
      logger.error("Error generating plan activities:", error);
      res.status(500).json({ error: "Failed to generate plan activities" });
    }
  }
);

// Generate plans based on goal, activities, and progress
router.post(
  "/generate-plans",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const { plan_goal, plan_activities, plan_progress } = req.body;

      if (!plan_goal || !plan_activities || !plan_progress) {
        return res.status(400).json({
          error: "plan_goal, plan_activities, and plan_progress are required",
        });
      }

      logger.info(`Generating plans for user ${req.user!.id}`);

      // Extract guidelines and generate plans using AI
      const guidelinesResult = await extractGuidelinesAndEmoji(
        plan_goal,
        plan_progress
      );

      logger.info("Guidelines result:", guidelinesResult);

      // Generate two plan options with different intensities
      const [plan1, plan2] = await Promise.all([
        generatePlan({
          userId: req.user!.id,
          goal: plan_goal,
          activities: plan_activities,
          progress: plan_progress,
          weeks: guidelinesResult.timeframes[0].weeks,
          sessionsPerWeek: guidelinesResult.timeframes[0].sessions_per_week,
          guidelines: guidelinesResult.guidelines,
          emoji: guidelinesResult.emoji,
          intensity: guidelinesResult.timeframes[0].intensity,
        }),
        generatePlan({
          userId: req.user!.id,
          goal: plan_goal,
          activities: plan_activities,
          progress: plan_progress,
          weeks: guidelinesResult.timeframes[1].weeks,
          sessionsPerWeek: guidelinesResult.timeframes[1].sessions_per_week,
          guidelines: guidelinesResult.guidelines,
          emoji: guidelinesResult.emoji,
          intensity: guidelinesResult.timeframes[1].intensity,
        }),
      ]);

      logger.info("Plan1:", plan1);
      logger.info("Plan2:", plan2);

      const relaxedPlan = plan1.intensity === "relaxed" ? plan1 : plan2;
      const intensePlan = plan1.intensity === "intense" ? plan1 : plan2;

      res.json({
        message: "Here are two plans for you to choose from",
        plans: [relaxedPlan, intensePlan],
        activities: plan_activities,
      });
    } catch (error) {
      logger.error("Error generating plans:", error);
      res.status(500).json({ error: "Failed to generate plans" });
    }
  }
);

// Helper function to extract guidelines and emoji
async function extractGuidelinesAndEmoji(
  planGoal: string,
  planProgress: string
): Promise<{
  guidelines: string;
  timeframes: Array<{
    weeks: number;
    sessions_per_week: string;
    intensity: "relaxed" | "intense";
  }>;
  emoji: string;
}> {
  const systemPrompt = `You are a coach of coaches. You create guidelines that help the coach create a plan for their client.`;

  const prompt = `Create guidelines for a coach to create a plan with goal '${planGoal}' for someone with progress '${planProgress}'`;

  try {
    const result = await aiService.generateStructuredResponse(
      prompt,
      z.object({
        guidelines: z
          .string()
          .describe(
            "Guidelines for the plan coach. The guidelines should be focused on ."
          ),
        timeframes: z.array(
          z.object({
            intensity: z
              .enum(["relaxed", "intense"])
              .describe(
                "Intensity of the plan. Intense plans are shorter (less weeks) and have more sessions per week than relaxed plans. "
              ),
            weeks: z.number().min(8).max(16),
            sessions_per_week: z
              .string()
              .describe(
                "Range of sessions per week. For example, '3-4' or '4-5'"
              ),
          })
        ),
        emoji: z.string(),
      }),
      systemPrompt
    );
    logger.debug("Guidelines and emoji:", result);
    return result;
  } catch (error) {
    logger.error("Error extracting guidelines and emoji:", error);
    // Fallback to defaults if AI fails
    return {
      guidelines:
        "Follow a progressive approach with consistency and gradual increases.",
      timeframes: [
        { weeks: 12, sessions_per_week: "3", intensity: "relaxed" },
        { weeks: 8, sessions_per_week: "4-5", intensity: "intense" },
      ],
      emoji: "🎯",
    };
  }
}

// Helper function to generate a plan TODO: this shoudl not be stored in DB, but returned
async function generatePlan(params: {
  userId: string;
  goal: string;
  activities: Activity[];
  progress: string;
  weeks: number;
  sessionsPerWeek: string;
  guidelines: string;
  emoji: string;
  intensity: "relaxed" | "intense";
}): Promise<{
  id: string;
  userId: string;
  goal: string;
  emoji: string;
  intensity: "relaxed" | "intense";
  activities: Activity[];
  finishingDate: Date;
  notes: string;
  sessions: {
    date: Date;
    activityId: string;
    descriptive_guide: string;
    quantity: number;
  }[];
}> {
  const finishingDate = new Date();
  finishingDate.setDate(finishingDate.getDate() + params.weeks * 7);

  const description = `${params.guidelines}\n\nWeeks: ${params.weeks}, Sessions per week: ${params.sessionsPerWeek}`;
  const sessionsResult = await aiService.generatePlanSessions({
    activities: params.activities,
    finishingDate: finishingDate,
    goal: params.goal,
    description,
  });

  return {
    id: uuidv4(),
    userId: params.userId,
    goal: params.goal,
    emoji: params.emoji,
    activities: params.activities,
    finishingDate: finishingDate,
    notes: description,
    sessions: sessionsResult.sessions,
    intensity: params.intensity,
  };
}

export const onboardingRouter: Router = router;
export default onboardingRouter;
