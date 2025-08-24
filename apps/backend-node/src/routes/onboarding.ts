import { Activity } from "@tsw/prisma";
import { Response, Router } from "express";
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

      const conversationHistory = await memoryService.readConversationHistory(
        req.user!.id,
        30
      );
      const fullConversation = conversationHistory
        ? `${conversationHistory}\n${req.user!.name || req.user!.username || "User"} (just now): ${message}`
        : `${req.user!.name || req.user!.username || "User"}: ${message}`;

      // Run parallel analysis
      const [questionAnalysis, goalParaphrase] = await Promise.all([
        aiService.analyzeQuestionCoverage(fullConversation, question_checks),
        paraphraseUserGoal(message),
      ]);

      const response: any = {
        question_checks: questionAnalysis.results,
      };

      if (!questionAnalysis.all_answered) {
        response.message = questionAnalysis.follow_up_message;
      } else {
        response.goal = goalParaphrase;
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
        }),
      ]);

      // Sort plans by intensity (more sessions = more intense)
      const sortedPlans = [plan1, plan2].sort((a, b) => {
        const aSessions = a.sessions?.length || 0;
        const bSessions = b.sessions?.length || 0;
        return bSessions - aSessions; // Descending order (more intense first)
      });

      res.json({
        message: "Here are two plans for you to choose from",
        plans: sortedPlans,
        activities: plan_activities,
      });
    } catch (error) {
      logger.error("Error generating plans:", error);
      res.status(500).json({ error: "Failed to generate plans" });
    }
  }
);

// Helper function to paraphrase user goal
async function paraphraseUserGoal(goal: string): Promise<string> {
  const systemPrompt = `You are a plan coach. Paraphrase goals to be short, concrete and tangible. 
  They should include the achievable result, not timeframe or details.
  Examples: 'I want to read 12 books this year' instead of 'i want to read more'
  'I want to run 10km in under 1 hour' instead of 'i want to run more'
  If the goal is already well phrased, output the same goal.`;

  return aiService.generateText(`Paraphrase my goal: '${goal}'`, systemPrompt);
}

// Helper function to extract guidelines and emoji
async function extractGuidelinesAndEmoji(
  planGoal: string,
  planProgress: string
): Promise<{
  guidelines: string;
  timeframes: Array<{ weeks: number; sessions_per_week: string }>;
  emoji: string;
}> {
  const systemPrompt = `You are a professional plan creator. Create guidelines for a progressive plan.
  Include tips, requirements, and considerations specific to this plan type.
  Provide timeframe ranges with total weeks (8-16) and sessions per week for two intensities:
  1. Relaxed option (fewer sessions per week)
  2. Intense option (more sessions per week)
  Format as JSON with guidelines, timeframes array, and one single emoji.`;

  const prompt = `Create guidelines for a plan with goal '${planGoal}' for someone with progress '${planProgress}'`;

  try {
    const result = await aiService.generateStructuredResponse(
      prompt,
      z.object({
        guidelines: z.string(),
        timeframes: z.array(
          z.object({
            weeks: z.number(),
            sessions_per_week: z.string(),
          })
        ),
        emoji: z.string().length(1),
      }),
      systemPrompt
    );
    return result;
  } catch (error) {
    // Fallback to defaults if AI fails
    return {
      guidelines:
        "Follow a progressive approach with consistency and gradual increases.",
      timeframes: [
        { weeks: 12, sessions_per_week: "3" },
        { weeks: 8, sessions_per_week: "4-5" },
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
}): Promise<any> {
  const finishingDate = new Date();
  finishingDate.setDate(finishingDate.getDate() + params.weeks * 7);

  // Create plan in database with plan activity associations
  const plan = await prisma.plan.create({
    data: {
      userId: params.userId,
      goal: params.goal,
      emoji: params.emoji,
      finishingDate: finishingDate,
      notes: `${params.guidelines}\n\nWeeks: ${params.weeks}, Sessions per week: ${params.sessionsPerWeek}`,
    },
  });

  // Create plan activities associations
  // for (const activity of params.activities) {
  //   await prisma.activity.create({
  //     data: {
  //       planId: plan.id,
  //       activityId: activity.id,
  //     },
  //   });
  // }

  // Generate basic sessions (simplified - would use AI in full implementation)
  const sessions = generateBasicSessions({
    planId: plan.id,
    activities: params.activities,
    weeks: params.weeks,
    sessionsPerWeek: parseInt(params.sessionsPerWeek.split("-")[0]),
    startDate: new Date(),
  });

  // Create sessions in database
  for (const session of sessions) {
    await prisma.planSession.create({
      data: session,
    });
  }

  return {
    ...plan,
    sessions,
    activities: params.activities,
  };
}

// Helper function to generate basic sessions
function generateBasicSessions(params: {
  planId: string;
  activities: any[];
  weeks: number;
  sessionsPerWeek: number;
  startDate: Date;
}): {
  planId: string;
  activityId: string;
  date: Date;
  descriptiveGuide: string;
  quantity: number;
}[] {
  const sessions: Array<{
    planId: string;
    activityId: string;
    date: Date;
    descriptiveGuide: string;
    quantity: number;
  }> = [];
  const currentDate = new Date(params.startDate);

  for (let week = 0; week < params.weeks; week++) {
    for (let session = 0; session < params.sessionsPerWeek; session++) {
      const sessionDate = new Date(currentDate);
      sessionDate.setDate(currentDate.getDate() + week * 7 + session);

      const activity = params.activities[session % params.activities.length];

      sessions.push({
        planId: params.planId,
        activityId: activity.id,
        date: sessionDate,
        descriptiveGuide: `Session ${session + 1} of week ${week + 1}`,
        quantity: 1, // Default quantity
      });
    }
  }

  return sessions;
}

// Health check
router.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "onboarding-routes",
  });
});

export const onboardingRouter: Router = router;
export default onboardingRouter;
