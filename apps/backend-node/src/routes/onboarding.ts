import { Activity } from "@tsw/prisma";
import { Response, Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod/v4";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth";
import { aiService } from "../services/aiService";
import { memoryService } from "../services/memoryService";
import { chatService } from "../services/chatService";
import { logger } from "../utils/logger";
import { prisma } from "../utils/prisma";
import dedent from "dedent";

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

      const { coach, chat } =
        await chatService.ensureOnboardingChatAndCoachExist(req.user!.id);

      // Store user message in memory
      await memoryService.writeMessage({
        content: message,
        chatId: chat.id,
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
      const [questionAnalysis, extractedPlans] = await Promise.all([
        aiService.analyzeQuestionCoverage(fullConversation, question_checks),
        aiService.extractPlans(message),
      ]);

      const response: any = {
        question_checks: questionAnalysis.results,
      };

      if (!questionAnalysis.all_answered) {
        response.message = questionAnalysis.follow_up_message;
      } else {
        // Return array of plans (supports multiple goals from single input)
        response.plans = extractedPlans.plans;
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

      const { coach, chat } =
        await chatService.ensureOnboardingChatAndCoachExist(req.user!.id);

      // Store user message in memory
      await memoryService.writeMessage({
        content: message,
        chatId: chat.id,
        role: "USER",
      });

      // Use only the selected plan goal as context, not conversation history
      // This ensures we extract activities for the specific goal the user selected,
      // not for other goals they may have mentioned earlier
      const userContext = `Plan goal: ${plan_goal}. User input: ${message}`;

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
    const schema = z.object({
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
    });

    const result = await aiService.generateStructuredResponse({
      prompt,
      schema,
      systemPrompt,
    });
    logger.debug("Guidelines and emoji:", result);
    return result as {
      guidelines: string;
      timeframes: {
        weeks: number;
        sessions_per_week: string;
        intensity: "relaxed" | "intense";
      }[];
      emoji: string;
    };
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

// Validate plan frequency based on user's experience level
router.post(
  "/validate-plan-frequency",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const { plan_goal, plan_progress, times_per_week } = req.body;

      if (!plan_goal || !plan_progress || times_per_week == null) {
        return res.status(400).json({
          error: "plan_goal, plan_progress, and times_per_week are required",
        });
      }

      logger.info(
        `Validating plan frequency for user ${req.user!.id}: ${times_per_week}x/week`
      );

      const schema = z.object({
        should_reduce: z
          .boolean()
          .describe(
            "Whether the user should reduce their frequency. True if they are overshooting based on their experience level."
          ),
        suggested_times_per_week: z
          .number()
          .nullable()
          .describe(
            "The suggested times per week if should_reduce is true. Null otherwise."
          ),
        reason: z
          .string()
          .nullable()
          .describe(
            "A short, encouraging reason for the suggestion (1-2 sentences). Null if no change needed."
          ),
      });
      const systemPrompt = dedent`
        You are a habit coach helping users build sustainable habits.

        Frequency guidelines:
        - Complete beginners: 2-3x/week max
        - Some experience: 3-4x/week max
        - Regular practitioners: 4-5x/week
        - Experienced: 5+x/week

        Keep reasons short (1-2 sentences), positive, and focused on building consistency first.
      `;

      const prompt = dedent`
        Goal: "${plan_goal}"
        Experience: "${plan_progress}"
        Planned frequency: ${times_per_week}x/week

        Analyze if this frequency is realistic for their experience level. Only suggest a reduction if there's a clear mismatch.

        If suggesting a reduction, keep it short (1-2 sentences), heartfelt, and coach-like. 

        Keep the tone simple, friendly, coach like, and 1 / 2 sentences max:
        Example: "6x a week for a complete beginner is tough! I strongly suggest you start with something less intense, as the main point is building an habit. It's a marathon, not a sprint. Consistency always beats intensity! 😊"
      `;

      const result = await aiService.generateStructuredResponse({
        prompt,
        schema,
        systemPrompt,
      });

      logger.info(`Frequency validation result: ${JSON.stringify(result)}`);

      res.json({
        suggested_times_per_week: result.should_reduce
          ? result.suggested_times_per_week
          : null,
        reason: result.should_reduce ? result.reason : null,
      });
    } catch (error) {
      logger.error("Error validating plan frequency:", error);
      res.status(500).json({ error: "Failed to validate plan frequency" });
    }
  }
);

export const onboardingRouter: Router = router;
export default onboardingRouter;
