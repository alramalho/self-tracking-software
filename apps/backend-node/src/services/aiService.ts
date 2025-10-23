import {
  createOpenRouter,
  OpenRouterProvider,
} from "@openrouter/ai-sdk-provider";
import { Activity, Plan, PlanOutlineType, User } from "@tsw/prisma";
import { generateObject, generateText } from "ai";
import { endOfWeek, format } from "date-fns";
import { z } from "zod/v4";
import { logger } from "../utils/logger";
import { getCurrentUser } from "../utils/requestContext";
import type { PlansService } from "./plansService";
const DEFAULT_WEEKS = 8;

// note to self 2:
// after note to self 1, we were amidst fully testing locally, as date changes broke things in unexpected ways
// specifiaclly, we were migrating to openrouter as we were facing some issues with models
// not being able to properly generate on first attempt the desired schema
// after that, we resume the dreadful work of making the app work
// fully remotely (we were also facing weird cloudfront 429, but we should fully clean up
// app before that as rn its probably making a shit ton of req, which it shouldn't anyway)
export class AIService {
  private model: string;
  // private openai;
  private plansService?: PlansService;

  constructor(plansService?: PlansService) {
    this.plansService = plansService;
    this.model = process.env.OPENROUTER_MODEL || "openai/gpt-4.1-mini";

    if (!process.env.OPENROUTER_API_KEY || !process.env.HELICONE_API_KEY) {
      throw new Error("OPENROUTER_API_KEY or HELICONE_API_KEY is not set");
    }
  }

  private getOpenRouterWithUserId(): OpenRouterProvider {
    const user = getCurrentUser();

    const headers = {
      "Helicone-Auth": `Bearer ${process.env.HELICONE_API_KEY}`,
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    };

    if (user?.id) {
      headers["Helicone-User-Id"] = user.id;
    } else {
      logger.debug("No user ID found, skipping Helicone-User-Id header");
    }

    if (user?.username) {
      headers["Helicone-Property-Username"] = user.username;
    }

    if (process.env.NODE_ENV) {
      headers["Helicone-Property-Environment"] = process.env.NODE_ENV;
    }

    return createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.helicone.ai/api/v1",
      headers,
      fetch: (url, options) => {
        const logOptions = { ...options };
        if (options?.body && typeof options.body === "string") {
          try {
            logOptions.body = JSON.parse(options.body);
          } catch {
            // Keep original if not valid JSON
          }
        }
        logger.debug("Fetching:", url, JSON.stringify(logOptions, null, 2));
        return fetch(url, options);
      },
    });
  }

  async generateText(
    prompt: string,
    systemPrompt?: string,
    options: { model: string; temperature: number } = {
      model: this.model,
      temperature: 0.7,
    }
  ): Promise<string> {
    try {
      console.log("Generating text with model:", options.model);
      console.log("Prompt:", prompt);
      console.log("System prompt:", systemPrompt);
      const openrouter = this.getOpenRouterWithUserId();
      const result = await generateText({
        model: openrouter.chat(options.model),
        prompt,
        system: systemPrompt,
        temperature: options.temperature,
      });

      return result.text;
    } catch (error) {
      logger.error("Error generating text:", error);
      throw new Error(`Text generation failed: ${error}`);
    }
  }

  async generateStructuredResponse<T>(
    prompt: string,
    schema: z.ZodSchema<T>,
    systemPrompt?: string,
    options: { model: string; temperature: number } = {
      model: this.model,
      temperature: 0.3,
    }
  ): Promise<T> {
    try {
      logger.debug("Generating structured response with model:", this.model);

      const openrouter = this.getOpenRouterWithUserId();
      const result = await generateObject({
        model: openrouter.chat(options.model),
        prompt,
        schema,
        system: systemPrompt,
        temperature: options.temperature,
      });

      return result.object;
    } catch (error) {
      logger.error("Error generating structured response:", error);
      throw new Error(`Structured response generation failed: ${error}`);
    }
  }

  // Activity extraction from text
  async extractActivities(
    message: string,
    userContext?: string
  ): Promise<{
    activities: Array<{
      activityId?: string;
      title: string;
      quantity: number;
      measure: string;
      date: string;
      description?: string;
    }>;
    confidence: number;
  }> {
    const schema = z.object({
      activities: z.array(
        z.object({
          activityId: z.string().optional(),
          title: z.string(),
          quantity: z.number(),
          measure: z.string(),
          date: z.string(),
          description: z.string().optional(),
        })
      ),
      confidence: z.number().min(0).max(1),
    });

    const systemPrompt =
      `You are an expert at extracting activity information from user messages. ` +
      `Extract any activities mentioned with their quantities, measures, and dates.` +
      `${userContext ? ` User context: ${userContext}` : ""}` +
      `` +
      `Guidelines:` +
      `- Only extract clear, specific activities` +
      `- Infer reasonable measures (e.g., "minutes", "reps", "miles")` +
      `- Use today's date if no date is mentioned` +
      `- Set confidence based on clarity of the information`;

    return this.generateStructuredResponse(message, schema, systemPrompt);
  }

  // Metrics extraction from text
  async extractMetrics(
    message: string,
    userContext?: string
  ): Promise<{
    metrics: Array<{
      metric_id?: string;
      name: string;
      rating: number;
      date: string;
      notes?: string;
    }>;
    confidence: number;
  }> {
    const schema = z.object({
      metrics: z.array(
        z.object({
          metric_id: z.string().optional(),
          name: z.string(),
          rating: z.number().min(1).max(10),
          date: z.string(),
          notes: z.string().optional(),
        })
      ),
      confidence: z.number().min(0).max(1),
    });

    const systemPrompt =
      `You are an expert at extracting metric ratings from user messages.` +
      `Extract any subjective ratings or feelings mentioned (mood, energy, sleep quality, etc.).` +
      `${userContext ? ` User context: ${userContext}` : ""}` +
      `` +
      `Guidelines:` +
      `- Rate on scale of 1-10 based on user's description` +
      `- Use today's date if no date is mentioned` +
      `- Common metrics: mood, energy, sleep, stress, focus, productivity` +
      `- Set confidence based on clarity of the sentiment`;

    return this.generateStructuredResponse(message, schema, systemPrompt);
  }

  // Plan creation from user goals with AI response
  async createPlanWithResponse(
    goals: string,
    userContext?: string
  ): Promise<{
    plan: {
      title: string;
      goal: string;
      description: string;
      duration_weeks: number;
      emoji?: string;
    };
    activities: Array<{
      title: string;
      measure: string;
      emoji: string;
      frequency_per_week: number;
      target_quantity: number;
    }>;
    ai_response: string;
    confidence: number;
  }> {
    const schema = z.object({
      plan: z.object({
        title: z.string(),
        goal: z.string(),
        description: z.string(),
        duration_weeks: z.number().min(1).max(52),
        emoji: z.string().optional(),
      }),
      activities: z.array(
        z.object({
          title: z.string(),
          measure: z.string(),
          emoji: z.string(),
          frequency_per_week: z.number().min(1).max(7),
          target_quantity: z.number().min(1),
        })
      ),
      ai_response: z.string(),
      confidence: z.number().min(0).max(1),
    });

    const systemPrompt =
      `You are an expert fitness and wellness coach. Create a realistic, achievable plan based on user goals and provide an encouraging response about the plan you've created.` +
      `${userContext ? ` User context: ${userContext}` : ""}` +
      `` +
      `Guidelines:` +
      `- Create specific, measurable activities` +
      `- Set realistic frequencies and quantities` +
      `- Include appropriate emojis` +
      `- Focus on sustainable habits` +
      `- Duration should be appropriate for the goal complexity` +
      `- Generate an encouraging AI response that references the specific plan you created` +
      `- Make the response personal and motivating`;

    return this.generateStructuredResponse(goals, schema, systemPrompt);
  }

  // Plan creation from user goals (separate method for backwards compatibility)
  async createPlan(
    goals: string,
    userContext?: string
  ): Promise<{
    plan: {
      title: string;
      goal: string;
      description: string;
      duration_weeks: number;
      emoji?: string;
    };
    activities: Array<{
      title: string;
      measure: string;
      emoji: string;
      frequency_per_week: number;
      target_quantity: number;
    }>;
    confidence: number;
  }> {
    const schema = z.object({
      plan: z.object({
        title: z.string(),
        goal: z.string(),
        description: z.string(),
        duration_weeks: z.number().min(1).max(52),
        emoji: z.string().optional(),
      }),
      activities: z.array(
        z.object({
          title: z.string(),
          measure: z.string(),
          emoji: z.string(),
          frequency_per_week: z.number().min(1).max(7),
          target_quantity: z.number().min(1),
        })
      ),
      confidence: z.number().min(0).max(1),
    });

    const systemPrompt =
      `You are an expert fitness and wellness coach. Create a realistic, achievable plan based on user goals.` +
      `${userContext ? ` User context: ${userContext}` : ""}` +
      `` +
      `Guidelines:` +
      `- Create specific, measurable activities` +
      `- Set realistic frequencies and quantities` +
      `- Include appropriate emojis` +
      `- Focus on sustainable habits` +
      `- Duration should be appropriate for the goal complexity`;

    return this.generateStructuredResponse(goals, schema, systemPrompt);
  }

  // Generate motivational messages
  async generateMotivationalMessage(
    userProfile: string,
    context: string
  ): Promise<string> {
    const systemPrompt =
      `You are a supportive wellness coach. Generate motivational messages that are:` +
      `- Encouraging but not overly optimistic` +
      `- Personalized to the user` +
      `- Actionable and specific` +
      `- Warm and genuine` +
      `` +
      `Avoid generic phrases and focus on the user's specific situation.`;

    const prompt =
      `User profile: ${userProfile}` +
      `Context: ${context}` +
      `` +
      `Generate a motivational message for this user.`;

    return this.generateText(prompt, systemPrompt);
  }

  // Method to inject plansService after initialization to avoid circular dependency
  setPlansService(plansService: PlansService): void {
    this.plansService = plansService;
  }

  /**
   * Shared helper to build plan context for coaching messages
   * @private
   */
  private async buildPlanContext(
    userName: string,
    plan: Plan & { activities: Activity[] },
    user: User
  ): Promise<string> {
    let achievement;
    let currentWeekStats;

    if (this.plansService) {
      try {
        const progressData = await this.plansService.getPlanProgress(
          plan,
          user
        );
        achievement = progressData.achievement;
        currentWeekStats = progressData.currentWeekStats;
      } catch (error) {
        logger.error("Could not get plan progress data", error);
        throw error;
      }
    }

    // Determine time context for this week
    const now = new Date();
    const endOfWeekDate = endOfWeek(now, { weekStartsOn: 0 }); // Sunday = 0
    const daysLeft = Math.ceil(
      (endOfWeekDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    let context = `${userName}'s plan: "${plan.goal}"`;

    if (currentWeekStats) {
      const { daysCompletedThisWeek, numActiveDaysInTheWeek } =
        currentWeekStats;
      const daysNeeded = numActiveDaysInTheWeek - daysCompletedThisWeek;

      // Determine week feasibility (aligned with PlanState calculation logic from plansService)
      let weekStatus: "COMPLETED" | "FAILED" | "AT_RISK" | "ON_TRACK";
      if (daysNeeded === 0) {
        weekStatus = "COMPLETED";
      } else if (daysNeeded > daysLeft) {
        // Impossible to complete = FAILED
        weekStatus = "FAILED";
      } else if (daysNeeded === daysLeft) {
        // No margin for error = AT_RISK
        weekStatus = "AT_RISK";
      } else {
        // Has buffer time = ON_TRACK
        weekStatus = "ON_TRACK";
      }

      context += `\n- This week: ${daysCompletedThisWeek}/${numActiveDaysInTheWeek} days completed`;
      context += `\n- Days needed: ${daysNeeded} more ${daysNeeded === 1 ? "day" : "days"}`;
      context += `\n- Time left: ${daysLeft} ${daysLeft === 1 ? "day" : "days"} remaining`;
      context += `\n- Week status: ${weekStatus}`;

      // If week is failed (impossible to complete), mention plan has been adjusted
      if (weekStatus === "FAILED") {
        context += `\n- Important: The plan has been automatically adjusted to be more achievable going forward`;
      }
    }

    if (achievement && achievement.streak > 0) {
      context += `\n- Current streak: ${achievement.streak} ${achievement.streak === 1 ? "week" : "weeks"}`;
    }

    return context;
  }

  // Extract activities for plan creation
  async extractActivitiesForPlan(
    message: string,
    userContext?: string
  ): Promise<{
    activities: Array<{
      title: string;
      emoji: string;
      measure: string;
      reasoning: string;
    }>;
    confidence: number;
  }> {
    const schema = z.object({
      activities: z.array(
        z.object({
          title: z.string(),
          emoji: z.string(),
          measure: z.string(),
          reasoning: z.string(),
        })
      ),
      confidence: z.number().min(0).max(1),
    });

    const systemPrompt =
      `You are an expert at extracting activities for plan creation.\m` +
      `${userContext ? ` Context: ${userContext}` : ""}\n` +
      `\n` +
      `Guidelines:` +
      `- Extract activities mentioned in the conversation\n` +
      `- Use atomic measures (e.g., 'pages', 'minutes', 'kilometers', NOT 'books' or 'marathons')\n` +
      `- Only single measure per activity (Never joint measures like 'pages or minutes')\n` +
      `- Provide clear reasoning for each activity\n` +
      `- Set confidence based on clarity of information\n` +
      `– Take special attention to the user messages in the conversation history, if any` +
      `\n` +
      `Examples:\n` +
      `- 'Reading' measured in 'pages' or 'minutes'\n` +
      `- 'Running' measured in 'kilometers' or 'minutes'\n` +
      `- 'Gym' measured in 'minutes' or 'sessions'\n`;
    return this.generateStructuredResponse(message, schema, systemPrompt);
  }

  // Check if conversation answers specific questions
  async analyzeQuestionCoverage(
    conversation: string,
    questions: Record<string, string>
  ): Promise<{
    all_answered: boolean;
    results: Array<{
      question: string;
      answered: boolean;
      reasoning: string;
      confidence: number;
    }>;
    follow_up_message: string;
  }> {
    const schema = z.object({
      all_answered: z.boolean(),
      results: z.array(
        z.object({
          question: z.string(),
          answered: z.boolean(),
          reasoning: z.string(),
          confidence: z.number().min(0).max(1),
        })
      ),
      follow_up_message: z.string(),
    });

    const systemPrompt =
      `You are an expert conversation analyst. Determine if the conversation contains sufficient information to answer each question.` +
      `` +
      `Guidelines:` +
      `- Be thorough in your analysis` +
      `- Provide clear reasoning for each decision` +
      `- Generate appropriate follow-up messages` +
      `- If all questions are answered, thank the user` +
      `- If questions remain, ask for the missing information specifically`;

    const prompt =
      `Conversation: ${conversation}` +
      `` +
      `Questions to check: ${JSON.stringify(questions, null, 2)}` +
      `` +
      `Analyze whether the conversation contains information to answer each question.`;

    return this.generateStructuredResponse(prompt, schema, systemPrompt);
  }

  // Paraphrase user goal with emoji
  async paraphraseGoal(goal: string): Promise<{
    goal: string;
    emoji: string;
  }> {
    const schema = z.object({
      goal: z.string(),
      emoji: z.string(),
    });

    // FIXME note to self: coach message and notes still shitty and not in sync with plan state: need to fix
    const systemPrompt =
      `You are a plan coach. Paraphrase goals to be short, concrete and tangible. ` +
      `They should include the achievable result, not timeframe or details.` +
      `Examples: 'I want to read 12 books this year' instead of 'i want to read more'` +
      `'I want to run 10km in under 1 hour' instead of 'i want to run more'` +
      `If the goal is already well phrased, output the same goal.` +
      `If the goal is already short, concrete, and tangible, output the same goal.` +
      `Also provide a relevant emoji that represents the goal.`;

    const prompt = `Paraphrase my goal: '${goal}'`;

    return this.generateStructuredResponse(prompt, schema, systemPrompt);
  }

  async generateCoachMessage(
    user: User,
    plan: Plan & { activities: Activity[] }
  ): Promise<{ title: string; message: string }> {
    const userName = user.name || user.username || "there";

    // Determine time-of-day context based on user's preferred coaching hour
    const preferredHour = user.preferredCoachingHour ?? 6;
    let timeOfDay = "check-in";
    if (preferredHour >= 5 && preferredHour < 12) {
      timeOfDay = "morning check-in";
    } else if (preferredHour >= 12 && preferredHour < 17) {
      timeOfDay = "afternoon check-in";
    } else if (preferredHour >= 17 && preferredHour < 21) {
      timeOfDay = "evening check-in";
    } else {
      timeOfDay = "check-in";
    }

    const schema = z.object({
      title: z
        .string()
        .describe(
          "A short, punchy title (3-5 words) summarizing the coaching update"
        ),
      message: z
        .string()
        .describe(
          "A brief, personalized coaching message (1-2 sentences) with actionable advice"
        ),
    });

    const systemPrompt =
      `You are a supportive personal coach sending a ${timeOfDay} to encourage the user. ` +
      `Title: Short, punchy summary (3-5 words) of the week's status or key point ` +
      `Message: Brief, personalized advice (1-2 sentences) that's encouraging but realistic, helping them stay on track ` +
      `` +
      `Keep it natural and varied - don't follow a fixed template. Focus on what matters most given the context. ` +
      `Use their name in the message. Optionally include 🔥 if it feels appropriate.`;

    // Build plan context using shared helper
    const context = await this.buildPlanContext(userName, plan, user);

    const prompt = `Generate a coaching notification for this user based on their current progress:\n\n${context}`;

    return this.generateStructuredResponse(prompt, schema, systemPrompt);
  }

  /**
   * Generate a post-activity celebration message sent immediately after activity completion
   * This congratulates the user and asks how it went
   */
  async generatePostActivityMessage(
    user: User,
    plan: Plan & { activities: Activity[] },
    activityEntry: { activityId: string; quantity: number; date: Date }
  ): Promise<{ title: string; message: string }> {
    const userName = user.name || user.username || "there";

    // Find the activity details
    const activity = plan.activities.find(
      (a) => a.id === activityEntry.activityId
    );
    if (!activity) {
      throw new Error(`Activity ${activityEntry.activityId} not found in plan`);
    }

    const schema = z.object({
      title: z
        .string()
        .describe(
          "A short, celebratory title (2-4 words) acknowledging the achievement"
        ),
      message: z
        .string()
        .describe(
          "A brief congratulatory message (1-2 sentences) that celebrates completion and asks how it went or how they feel"
        ),
    });

    const systemPrompt =
      `You are a supportive personal coach sending an IMMEDIATE CELEBRATION right after the user completed an activity. ` +
      `Title: Short, celebratory (2-4 words) acknowledging what they just did ` +
      `Message: Congratulate them briefly (1-2 sentences) and ask how it went or how they feel. Be genuine and warm. ` +
      `` +
      `Keep it natural and varied - don't follow a fixed template. This is a moment of celebration! ` +
      `Use their name in the message. Optionally include 🔥, 💪, or ✨ if it feels appropriate.`;

    // Build plan context using shared helper
    const context = await this.buildPlanContext(userName, plan, user);

    // Add activity-specific context
    const activityContext =
      `${context}\n\n` +
      `- Just completed: ${activityEntry.quantity} ${activity.measure} of ${activity.emoji} ${activity.title}`;

    const prompt = `Generate a celebration message for this user who just completed an activity:\n\n${activityContext}`;

    return this.generateStructuredResponse(prompt, schema, systemPrompt);
  }

  async generatePlanSessions(params: {
    goal: string;
    finishingDate?: Date;
    activities: any[];
    description?: string;
    existingPlan?: any;
    sessionsPerWeek?: number;
  }): Promise<{
    sessions: {
      date: Date;
      activityId: any;
      descriptive_guide: string;
      quantity: number;
    }[];
  }> {
    try {
      const today = new Date();
      const todayReadableDate = today.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        weekday: "long",
      });

      let finishingDate: Date;
      console.log({ finishingDate: params.finishingDate });
      if (params.finishingDate) {
        finishingDate = new Date(params.finishingDate);
      } else {
        finishingDate = new Date(
          today.getTime() + DEFAULT_WEEKS * 7 * 24 * 60 * 60 * 1000
        );
      }
      const weeks = Math.ceil(
        (finishingDate.getTime() - today.getTime()) / (7 * 24 * 60 * 60 * 1000)
      );

      console.log(`The plan has weeks: ${weeks}`);

      // Calculate week start dates (all Sundays, starting from last/current Sunday)
      const weekStartDates: string[] = [];

      // Find the last Sunday before today (or today if today is Sunday)
      let currentWeekStart = new Date(today);
      const dayOfWeek = currentWeekStart.getDay(); // 0 = Sunday, 1 = Monday, etc.

      if (dayOfWeek !== 0) {
        // Go back to last Sunday
        currentWeekStart.setDate(currentWeekStart.getDate() - dayOfWeek);
      }

      // Generate all Sunday start dates for the plan duration
      for (let i = 0; i < weeks; i++) {
        weekStartDates.push(currentWeekStart.toISOString().split("T")[0]);

        // Move to next Sunday
        const nextSunday = new Date(currentWeekStart);
        nextSunday.setDate(currentWeekStart.getDate() + 7);
        currentWeekStart = nextSunday;
      }

      const finishingDateReadable = finishingDate.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        weekday: "long",
      });

      let introduction: string;
      if (params.existingPlan && params.description) {
        // Get existing sessions for context (limit to first 10)
        const existingSessions =
          params.existingPlan.sessions?.slice(0, 10) || [];
        const sessionContext = existingSessions
          .map((s: any) => {
            const activity = params.activities.find(
              (a) => a.id === s.activityId
            );
            const sessionDate = new Date(s.date).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              weekday: "long",
            });
            return `–${activity?.title || "Unknown"} (${s.quantity} ${activity?.measure || "units"}) on ${sessionDate}`;
          })
          .join("\n");

        introduction =
          `You are a plan coach assistant. You are coaching with the plan '${params.goal}'` +
          `Your task is to generate an adapted plan based on this edit description: \n-${params.description}\n` +
          `` +
          `Here are the CURRENT plan next 10 sessions for reference:` +
          `${sessionContext}` +
          `` +
          `You must use this information thoughtfully as the basis for your plan generation. In regards to that:` +
          `Today is ${todayReadableDate}, so there cannot be any activity in the past.` +
          `The plan has the finishing date of ${finishingDateReadable}.` +
          `Additional requirements:`;
      } else {
        introduction =
          `You will act as a personal coach for the goal of ${params.goal}.` +
          `The plan has the finishing date of ${finishingDateReadable} and today is ${todayReadableDate}.`;
      }

      const systemPrompt =
        `${introduction}` +
        `Today is ${todayReadableDate}, so there cannot be any activity in the past.` +
        `You must develop a progressive plan over the course of ${weeks} weeks.` +
        `The weeks start on the following dates: ${weekStartDates.join(", ")}` +
        `Keep the activities to a minimum.` +
        `The plan should be progressive (intensities or recurrence of activities should increase over time).` +
        `The plan should take into account the finishing date and adjust the intensity and/or recurrence of the activities accordingly.` +
        `It is an absolute requirement that all present sessions activity names are contained in the list of activities.` +
        params.sessionsPerWeek
          ? `The plan should have ${params.sessionsPerWeek} sessions per week.`
          : "" +
            `` +
            `Please only include these activities in plan:` +
            `${params.activities.map((a) => `- ${a.title} (${a.measure})`).join("\n")}`;

      let userPrompt = `Please generate me a plan to achieve the goal of ${params.goal} by ${finishingDateReadable}.`;
      if (params.description) {
        userPrompt += ` Additional description: ${params.description}`;
      }

      const GeneratedSession = z.object({
        date: z
          .string()
          .describe(
            `The date of the session in YYYY-MM-DD format. Must be after ${format(new Date(), "yyyy-MM-dd")} (today).`
          ),
        activity_name: z
          .enum(params.activities.map((a) => a.title))
          .describe(
            "The name of the activity to be performed. Should have no emoji to match exactly with the activity title."
          ),
        quantity: z
          .number()
          .describe(
            "The quantity of the activity to be performed. Directly related to the activity and should be measured in the same way."
          ),
      });

      const GeneratedSessionWeek = z.object({
        week_start_date: z
          .enum(weekStartDates as [string, ...string[]])
          .describe(
            `The start date of the week in YYYY-MM-DD format. Must be one of: ${weekStartDates.join(", ")}`
          ),
        reasoning: z
          .string()
          .describe(
            "A step by step thinking outlining the week's outlook given current and leftover progress. Must be deep and reflective."
          ),
        sessions: z
          .array(GeneratedSession)
          .describe("List of sessions for this week."),
      });

      const GenerateSessionsResponse = z.object({
        reasoning: z
          .string()
          .describe(
            "A reflection on what is the goal and how does that affect the sessions progression."
          ),
        weeks: z
          .array(GeneratedSessionWeek)
          .describe("List of weeks with their sessions."),
      });

      // Use AI service to generate structured response
      const response = await this.generateStructuredResponse(
        userPrompt,
        GenerateSessionsResponse,
        systemPrompt
      );

      logger.info("Generated sessions:", response);

      // Convert generated sessions to the expected format
      const sessions: Array<{
        date: Date;
        activityId: any;
        descriptive_guide: string;
        quantity: number;
      }> = [];
      for (const week of response.weeks) {
        logger.info(
          `Week starting ${week.week_start_date}. Has ${week.sessions.length} sessions.`
        );

        for (const session of week.sessions) {
          // Find matching activity
          const activity = params.activities.find(
            (a) => a.title.toLowerCase() === session.activity_name.toLowerCase()
          );

          if (activity) {
            sessions.push({
              date: new Date(session.date),
              activityId: activity.id,
              descriptive_guide: `${activity.title} - ${session.quantity} ${activity.measure}`,
              quantity: session.quantity,
            });
          }
        }
      }

      return { sessions };
    } catch (error) {
      logger.error("Error in AI session generation:", error);
      // Fallback to basic generation
      return {
        sessions: await this.generateBasicPlanSessions({
          activities: params.activities,
          weeks: DEFAULT_WEEKS,
          startDate: new Date(),
          goal: params.goal,
        }),
      };
    }
  }

  async generateBasicPlanSessions(params: {
    activities: any[];
    weeks: number;
    startDate: Date;
    goal: string;
  }): Promise<
    {
      date: Date;
      activityId: any;
      descriptive_guide: string;
      quantity: number;
    }[]
  > {
    const sessions: Array<{
      date: Date;
      activityId: any;
      descriptive_guide: string;
      quantity: number;
    }> = [];
    const sessionsPerWeek = 3; // Default 3 sessions per week

    for (let week = 0; week < params.weeks; week++) {
      for (let sessionNum = 0; sessionNum < sessionsPerWeek; sessionNum++) {
        const sessionDate = new Date(params.startDate);
        sessionDate.setDate(
          params.startDate.getDate() + week * 7 + sessionNum * 2
        ); // Every other day

        const activity =
          params.activities[sessionNum % params.activities.length];
        const progressMultiplier = 1 + week * 0.1; // 10% increase per week

        sessions.push({
          date: sessionDate,
          activityId: activity.id,
          descriptive_guide: `Week ${week + 1}, Session ${sessionNum + 1}: Focus on ${activity.title}`,
          quantity: Math.ceil(progressMultiplier * (sessionNum + 1)), // Progressive quantity
        });
      }
    }

    return sessions;
  }

  async generateCoachNotes(
    plan: { goal: string; outlineType: PlanOutlineType; timesPerWeek?: number },
    newPlanState: "FAILED" | "COMPLETED" | "AT_RISK" | "ON_TRACK",
    planActivities: Array<{ id: string; title: string; measure: string }>,
    changes?: {
      type: "times_reduced" | "sessions_downgraded" | "none";
      oldTimesPerWeek?: number;
      newTimesPerWeek?: number;
      oldSessions?: Array<{
        date: string;
        activityId: string;
        quantity: number;
        descriptiveGuide?: string;
      }>;
      newSessions?: Array<{
        date: string;
        activityId: string;
        quantity: number;
        descriptiveGuide?: string;
      }>;
    }
  ): Promise<string> {
    const currentDate = new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      weekday: "long",
    });

    const system =
      `You are an expert coach assisting the user with the plan '${plan.goal}'. ` +
      `Your task is to generate brief coach notes (2-3 sentences) that: ` +
      `1. Clearly explain what specific adjustment was made to the plan (if any) ` +
      `2. Briefly explain WHY this adjustment helps given their performance ` +
      `3. Provide encouragement that's realistic and actionable. ` +
      `` +
      `Key principles: ` +
      `- Be specific about what changed (e.g., "Reduced from 4 to 3 times per week") ` +
      `- Focus on the reason for the change (e.g., "building consistency", "capitalizing on momentum") ` +
      `- Keep tone supportive but realistic, never generic or overly enthusiastic ` +
      `- Today is ${currentDate}` +
      `` +
      `State-specific requirements: ` +
      `- FAILED: MUST mention the specific adjustment made and why it helps ` +
      `- AT_RISK: NO adjustment was made - MUST explicitly state no changes, acknowledge tight timeline/urgency (e.g., "no room for error", "tight window"), do NOT suggest any changes or considerations ` +
      `- ON_TRACK: MUST acknowledge good progress/buffer, do NOT mention adjustments ` +
      `- COMPLETED: MUST celebrate success, do NOT mention adjustments`;

    let messages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }>;

    if (plan.outlineType === PlanOutlineType.TIMES_PER_WEEK) {
      const generateMessageStr = (
        activities: Array<{ title: string; measure: string }>,
        state: typeof newPlanState,
        planGoal: string,
        changeInfo?: {
          type: "times_reduced" | "none";
          oldTimesPerWeek?: number;
          newTimesPerWeek?: number;
        }
      ) => {
        const performanceMap = {
          FAILED: "poor",
          COMPLETED: "excellent",
          AT_RISK: "concerning",
          ON_TRACK: "good",
        };
        const performance = performanceMap[state];
        const activitiesStr = activities
          .map((a) => `${a.title} (measured in ${a.measure})`)
          .join(", ");

        let changeDescription = "";
        if (changeInfo?.type === "times_reduced") {
          changeDescription = ` The plan was adjusted from ${changeInfo.oldTimesPerWeek} to ${changeInfo.newTimesPerWeek} times per week.`;
        } else if (changeInfo?.type === "none") {
          changeDescription = " No adjustments were made to the plan.";
        }

        return (
          `This week I had a ${performance} performance. My Plan: '${planGoal}', consisting ` +
          `of doing any of the activities ${activitiesStr}.${changeDescription}`
        );
      };

      messages = [
        { role: "system", content: system },
        {
          role: "user",
          content: generateMessageStr(
            [
              { title: "Running", measure: "km" },
              { title: "Gym Session", measure: "session" },
            ],
            "FAILED",
            "I want to exercise regularly to improve my fitness",
            {
              type: "times_reduced",
              oldTimesPerWeek: 4,
              newTimesPerWeek: 3,
            }
          ),
        },
        {
          role: "assistant",
          content:
            "Reduced from 4 to 3 times per week. Focus on consistency over intensity - building the habit is more important than hitting ambitious targets right now.",
        },
        {
          role: "user",
          content: generateMessageStr(
            [{ title: "Reading", measure: "pages" }],
            "COMPLETED",
            "I want to read more books this year",
            { type: "none" }
          ),
        },
        {
          role: "assistant",
          content:
            "No changes needed - you nailed it this week! This consistency is exactly how lasting habits form.",
        },
        {
          role: "user",
          content: generateMessageStr(
            [{ title: "Yoga", measure: "minutes" }],
            "AT_RISK",
            "I want to practice yoga regularly",
            { type: "none" }
          ),
        },
        {
          role: "assistant",
          content:
            "No adjustments made - but time is tight with no room to miss any remaining sessions. Stay focused on completing each one to finish strong this week.",
        },
        {
          role: "user",
          content: generateMessageStr(
            [{ title: "Writing", measure: "words" }],
            "AT_RISK",
            "I want to write consistently",
            { type: "none" }
          ),
        },
        {
          role: "assistant",
          content:
            "Plan stays the same - but you'll need to hit all remaining days to complete this week. The window is tight, so prioritize getting them done.",
        },
        {
          role: "user",
          content: generateMessageStr(
            [{ title: "Swimming", measure: "laps" }],
            "ON_TRACK",
            "I want to improve my swimming endurance",
            { type: "none" }
          ),
        },
        {
          role: "assistant",
          content:
            "Keeping the plan as is - you've got solid momentum and room to spare. Stay the course.",
        },
        {
          role: "user",
          content: generateMessageStr(
            [
              { title: "Meditation", measure: "minutes" },
              { title: "Journaling", measure: "pages" },
            ],
            "FAILED",
            "I want to improve my mental wellness",
            {
              type: "times_reduced",
              oldTimesPerWeek: 5,
              newTimesPerWeek: 4,
            }
          ),
        },
        {
          role: "assistant",
          content:
            "Adjusted to 4 times per week from 5. Starting smaller helps build the routine without overwhelming your schedule.",
        },
        {
          role: "user",
          content: generateMessageStr(
            [{ title: "Cooking", measure: "meals" }],
            "COMPLETED",
            "I want to cook more meals at home",
            { type: "none" }
          ),
        },
        {
          role: "assistant",
          content:
            "Great week - no changes needed! You're proving you can sustain this pace.",
        },
        {
          role: "user",
          content: generateMessageStr(
            planActivities,
            newPlanState,
            plan.goal,
            changes?.type === "times_reduced"
              ? {
                  type: "times_reduced",
                  oldTimesPerWeek: changes.oldTimesPerWeek,
                  newTimesPerWeek: changes.newTimesPerWeek,
                }
              : { type: "none" }
          ),
        },
      ];
    } else {
      // SPECIFIC plan type with sessions
      if (
        !changes ||
        changes.type !== "sessions_downgraded" ||
        !changes.oldSessions ||
        !changes.newSessions
      ) {
        // For non-FAILED states, no sessions were changed, so we need minimal context
        if (changes?.type === "none") {
          const performanceMap = {
            FAILED: "poor",
            COMPLETED: "excellent",
            AT_RISK: "concerning",
            ON_TRACK: "good",
          };
          const performance = performanceMap[newPlanState];

          messages = [
            { role: "system", content: system },
            {
              role: "user",
              content: `This week I had ${performance} performance on my plan: '${plan.goal}'. No adjustments were made to the plan.`,
            },
          ];
        } else {
          throw new Error(
            "oldSessions and newSessions in changes are required for SPECIFIC plan types with sessions_downgraded"
          );
        }
      } else {
        const formatSessionsStr = (
          sessions: Array<{
            date: string;
            activityId: string;
            quantity: number;
            descriptiveGuide?: string;
          }>
        ) => {
          return sessions
            .map((session) => {
              const activity = planActivities.find(
                (a) => a.id === session.activityId
              );
              const sessionDate = new Date(session.date).toLocaleDateString(
                "en-US",
                {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  weekday: "long",
                }
              );
              return `–${activity?.title || "Unknown"} (${session.quantity} ${activity?.measure || "units"}) on ${sessionDate}`;
            })
            .join("\n");
        };

        const generateMessageStr = (
          oldSessionsList: Array<{
            date: string;
            activityId: string;
            quantity: number;
            descriptiveGuide?: string;
          }>,
          newSessionsList: Array<{
            date: string;
            activityId: string;
            quantity: number;
            descriptiveGuide?: string;
          }>,
          state: typeof newPlanState,
          planGoal: string
        ) => {
          const performanceMap = {
            FAILED: "poor",
            COMPLETED: "excellent",
            AT_RISK: "concerning",
            ON_TRACK: "good",
          };
          const performance = performanceMap[state];
          const oldSessionsStr = formatSessionsStr(oldSessionsList);
          const newSessionsStr = formatSessionsStr(newSessionsList);

          return `This week I had a ${performance} performance. My Plan: '${planGoal}'. Sessions were adjusted:\nOld sessions:\n${oldSessionsStr}\nNew sessions:\n${newSessionsStr}`;
        };

        messages = [
          { role: "system", content: system },
          {
            role: "user",
            content: generateMessageStr(
              [
                {
                  date: "2024-12-16",
                  activityId: "running_001",
                  quantity: 5,
                  descriptiveGuide: "Start with moderate pace",
                },
                {
                  date: "2024-12-17",
                  activityId: "gym_001",
                  quantity: 1,
                  descriptiveGuide: "Full body workout",
                },
                {
                  date: "2024-12-19",
                  activityId: "running_001",
                  quantity: 6,
                  descriptiveGuide: "Increase distance",
                },
              ],
              [
                {
                  date: "2024-12-16",
                  activityId: "running_001",
                  quantity: 3,
                  descriptiveGuide: "Easy pace, focus on completion",
                },
                {
                  date: "2024-12-18",
                  activityId: "gym_001",
                  quantity: 1,
                  descriptiveGuide: "Light workout, basic movements",
                },
              ],
              "FAILED",
              "I want to build strength for daily activities"
            ),
          },
          {
            role: "assistant",
            content:
              "Reduced running distance from 5-6km to 3km and removed one session. Building consistency matters more than intensity at this stage.",
          },
          {
            role: "user",
            content: generateMessageStr(
              [
                {
                  date: "2024-12-17",
                  activityId: "yoga_001",
                  quantity: 30,
                  descriptiveGuide: "Morning flow",
                },
                {
                  date: "2024-12-19",
                  activityId: "yoga_001",
                  quantity: 45,
                  descriptiveGuide: "Evening stretch",
                },
              ],
              [
                {
                  date: "2024-12-17",
                  activityId: "yoga_001",
                  quantity: 20,
                  descriptiveGuide: "Gentle morning practice",
                },
                {
                  date: "2024-12-20",
                  activityId: "yoga_001",
                  quantity: 20,
                  descriptiveGuide: "Easy evening wind-down",
                },
              ],
              "FAILED",
              "I want to improve flexibility and reduce stress"
            ),
          },
          {
            role: "assistant",
            content:
              "Scaled back to 20-minute sessions from 30-45 minutes. Shorter practices are easier to fit in and complete consistently.",
          },
          {
            role: "user",
            content: generateMessageStr(
              changes.oldSessions,
              changes.newSessions,
              newPlanState,
              plan.goal
            ),
          },
        ];
      }
    }

    try {
      const openrouter = this.getOpenRouterWithUserId();
      const result = await generateText({
        model: openrouter.chat("openai/gpt-4.1-mini"),
        messages,
        temperature: 1,
      });

      logger.info(`Generated coach notes: ${result.text}`);
      return result.text;
    } catch (error) {
      logger.error("Error generating coach notes:", error);
      throw new Error(`Coach notes generation failed: ${error}`);
    }
  }
}

// Note: plansService will be injected when needed to avoid circular dependency
export const aiService = new AIService();
