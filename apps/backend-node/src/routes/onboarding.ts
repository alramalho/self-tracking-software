import { Activity } from "@tsw/prisma";
import { Response, Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod/v4";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth";
import { aiService } from "../services/aiService";
import { perplexityAiService } from "../services/perplexityAiService";
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

// Generate plan based on goal, activities, and progress
router.post(
  "/generate-plans",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const { plan_goal, plan_activities, plan_progress, wants_coaching, times_per_week } = req.body;

      // For coached mode, activities are optional (the pipeline will generate them)
      if (!plan_goal || !plan_progress) {
        return res.status(400).json({
          error: "plan_goal and plan_progress are required",
        });
      }

      // If not coaching mode, activities are required
      if (!wants_coaching && (!plan_activities || plan_activities.length === 0)) {
        return res.status(400).json({
          error: "plan_activities are required for self-guided plans",
        });
      }

      logger.info(`Generating plan for user ${req.user!.id} (coaching: ${wants_coaching})`);

      // Infer times per week from experience if not provided
      const timesPerWeek = times_per_week || inferTimesPerWeek(plan_progress);

      // Do research once using Perplexity
      const researchResult = await perplexityAiService.researchPlan({
        goal: plan_goal,
        experience: plan_progress,
        timesPerWeek,
      });

      logger.info("Research completed, generating plan...");

      // Generate single plan with research-based guidelines
      const plan = await generatePlan({
        userId: req.user!.id,
        goal: plan_goal,
        activities: plan_activities,
        progress: plan_progress,
        weeks: researchResult.estimatedWeeks || 12, // Use estimated or default 12 weeks
        timesPerWeek,
        researchFindings: researchResult.guidelines,
        estimatedWeeks: researchResult.estimatedWeeks,
      });

      logger.info("Plan generated:", plan.id);

      res.json({
        message: "Your plan is ready",
        plans: [plan],
        activities: plan.activities,
      });
    } catch (error) {
      logger.error("Error generating plans:", error);
      res.status(500).json({ error: "Failed to generate plans" });
    }
  }
);

// Infer times per week based on experience level
function inferTimesPerWeek(experience: string): number {
  const lowerExp = experience.toLowerCase();
  if (
    lowerExp.includes("beginner") ||
    lowerExp.includes("never") ||
    lowerExp.includes("new") ||
    lowerExp.includes("starting")
  ) {
    return 3;
  }
  if (
    lowerExp.includes("some") ||
    lowerExp.includes("little") ||
    lowerExp.includes("occasionally")
  ) {
    return 3;
  }
  if (
    lowerExp.includes("regular") ||
    lowerExp.includes("often") ||
    lowerExp.includes("weekly")
  ) {
    return 4;
  }
  if (
    lowerExp.includes("advanced") ||
    lowerExp.includes("years") ||
    lowerExp.includes("experienced")
  ) {
    return 5;
  }
  return 3; // Default for beginners
}


async function generatePlan(params: {
  userId: string;
  goal: string;
  activities: Activity[];
  progress: string;
  weeks: number;
  timesPerWeek: number;
  researchFindings: string;
  estimatedWeeks: number | null;
}): Promise<{
  id: string;
  userId: string;
  goal: string;
  emoji: string;
  activities: Activity[];
  finishingDate: Date;
  notes: string;
  internalNotes: string;
  estimatedWeeks: number | null;
  sessions: {
    date: Date;
    activityId: string;
    descriptive_guide: string;
    quantity: number;
    imageUrls?: string[];
  }[];
}> {
  const finishingDate = new Date();
  finishingDate.setDate(finishingDate.getDate() + params.weeks * 7);

  // Fetch user age for the pipeline
  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { age: true },
  });

  const sessionsResult = await aiService.generatePlanSessions({
    activities: params.activities || [],
    finishingDate: finishingDate,
    goal: params.goal,
    description: params.researchFindings,
    // Parameters for the pipeline
    userAge: user?.age ?? null,
    experience: params.progress,
    timesPerWeek: params.timesPerWeek,
    maxWeeks: 2, // Only generate first 2 weeks of sessions
    researchFindings: params.researchFindings,
  });

  // Handle activities from the pipeline
  // Build a map of temp IDs (new_1, new_2) to real DB IDs
  const activityIdMap: Record<string, string> = {};
  let finalActivities: Activity[] = [];

  // If pipeline generated activities, create them in DB
  if (sessionsResult.activities && sessionsResult.activities.length > 0) {
    for (const activity of sessionsResult.activities) {
      // Check if activity ID starts with "new_" (generated by pipeline)
      if (activity.id.startsWith("new_")) {
        // Check if activity with same name already exists
        const existingActivity = await prisma.activity.findFirst({
          where: {
            userId: params.userId,
            title: { equals: activity.title, mode: "insensitive" },
            measure: { equals: activity.measure, mode: "insensitive" },
          },
        });

        if (existingActivity) {
          activityIdMap[activity.id] = existingActivity.id;
          finalActivities.push(existingActivity);
        } else {
          // Create new activity
          const newActivity = await prisma.activity.create({
            data: {
              userId: params.userId,
              title: activity.title,
              emoji: activity.emoji || "🎯",
              measure: activity.measure,
            },
          });
          activityIdMap[activity.id] = newActivity.id;
          finalActivities.push(newActivity);
          logger.info(`Created activity from pipeline: ${activity.title}`);
        }
      } else {
        // Existing activity - map to itself
        activityIdMap[activity.id] = activity.id;
        const existingActivity = params.activities?.find(a => a.id === activity.id);
        if (existingActivity) {
          finalActivities.push(existingActivity);
        }
      }
    }
  } else if (params.activities && params.activities.length > 0) {
    // Use provided activities if pipeline didn't return any
    finalActivities = [...params.activities];
    for (const activity of params.activities) {
      activityIdMap[activity.id] = activity.id;
    }
  }

  // Remap session activityIds from temp IDs to real DB IDs
  const remappedSessions = sessionsResult.sessions.map(session => ({
    ...session,
    activityId: activityIdMap[session.activityId] || session.activityId,
  }));

  // Use emoji from first activity or default
  const emoji = finalActivities[0]?.emoji || "🎯";

  // Generate user-facing notes summarizing the plan focus
  const userNotes = await generatePlanSummary({
    goal: params.goal,
    activities: finalActivities,
    experience: params.progress,
    timesPerWeek: params.timesPerWeek,
  });

  return {
    id: uuidv4(),
    userId: params.userId,
    goal: params.goal,
    emoji,
    activities: finalActivities,
    finishingDate: finishingDate,
    notes: userNotes,
    internalNotes: `[Perplexity Research Guidelines]\n\n${params.researchFindings}`,
    estimatedWeeks: params.estimatedWeeks,
    sessions: remappedSessions,
  };
}

async function generatePlanSummary(params: {
  goal: string;
  activities: Activity[];
  experience: string;
  timesPerWeek: number;
}): Promise<string> {
  try {
    const schema = z.object({
      summary: z.string().describe("A 1-2 sentence summary of what this plan focuses on"),
    });

    const result = await aiService.generateStructuredResponse({
      prompt: dedent`
        Generate a brief, friendly summary (1-2 sentences) of what this training plan focuses on.

        Goal: ${params.goal}
        Activities: ${params.activities.map(a => a.title).join(", ")}
        Experience level: ${params.experience}
        Frequency: ${params.timesPerWeek} times per week

        The summary should explain the plan's approach in a motivating way.
        Example: "This plan builds your running foundation with easy runs and gradual progression, focusing on consistency over speed."
      `,
      schema,
      systemPrompt: "You write concise, motivating plan summaries. Keep it to 1-2 sentences.",
    });

    return result.summary;
  } catch (error) {
    logger.error("Error generating plan summary:", error);
    return `A ${params.timesPerWeek}x/week plan to help you ${params.goal.toLowerCase()}.`;
  }
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
