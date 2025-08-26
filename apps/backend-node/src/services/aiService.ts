import {
  createOpenRouter,
  OpenRouterProvider,
} from "@openrouter/ai-sdk-provider";
import { generateObject, generateText } from "ai";
import { z } from "zod/v4";
import { logger } from "../utils/logger";

const DEFAULT_WEEKS = 8;

// note to self:
// we were amidst fully testing locally, as date changes broke things in unexpected ways
// specifiaclly, we were migrating to openrouter as we were facing some issues with models
// not being able to properly generate on first attempt the desired schema
// after that, we resume the dreadful work of making the app work
// fully remotely (we were also facing weird cloudfront 429, but we should fully clean up
// app before that as rn its probably making a shit ton of req, which it shouldn't anyway)
export class AIService {
  private model: string;
  // private openai;
  private openrouter: OpenRouterProvider;

  constructor() {
    this.model = process.env.OPENROUTER_MODEL || "openai/gpt-4.1-mini"; // "deepseek/deepseek-chat-v3.1"
    // this.openai = createOpenAICompatible({
    //   name: "openrouter",
    //   apiKey: process.env.OPENROUTER_API_KEY,
    //   baseURL: "https://openrouter.helicone.ai/api/v1",
    // });

    if (!process.env.OPENROUTER_API_KEY || !process.env.HELICONE_API_KEY) {
      throw new Error("OPENROUTER_API_KEY or HELICONE_API_KEY is not set");
    }

    this.openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.helicone.ai/api/v1",
      headers: {
        "Helicone-Auth": `Bearer ${process.env.HELICONE_API_KEY}`,
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      },
      fetch: (url, options) => {
        const logOptions = { ...options };
        if (options?.body && typeof options.body === "string") {
          try {
            logOptions.body = JSON.parse(options.body);
          } catch {
            // Keep original if not valid JSON
          }
        }
        // console.debug("Fetching:", url, JSON.stringify(logOptions, null, 2));
        return fetch(url, options);
      },
    });
  }

  async generateText(prompt: string, systemPrompt?: string): Promise<string> {
    try {
      const result = await generateText({
        model: this.openrouter.chat(this.model),
        prompt,
        system: systemPrompt,
        temperature: 0.7,
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
    systemPrompt?: string
  ): Promise<T> {
    try {
      console.log("Generating structured response with model:", this.model);
      const result = await generateObject({
        model: this.openrouter.chat(this.model),
        prompt,
        schema,
        system: systemPrompt,
        temperature: 0.3,
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

  // Analyze user profile from conversation
  async analyzeUserProfile(
    conversation: string,
    questions: string[]
  ): Promise<{
    profile: string;
    age?: number;
    interests: string[];
    goals: string[];
    question_analysis: Array<{
      question: string;
      answered: boolean;
      answer?: string;
      confidence: number;
    }>;
  }> {
    const schema = z.object({
      profile: z.string(),
      age: z.number().optional(),
      interests: z.array(z.string()),
      goals: z.array(z.string()),
      question_analysis: z.array(
        z.object({
          question: z.string(),
          answered: z.boolean(),
          answer: z.string().optional(),
          confidence: z.number().min(0).max(1),
        })
      ),
    });

    const systemPrompt =
      `You are an expert at analyzing user conversations to build comprehensive profiles.` +
      `Analyze the conversation and determine what information is available about the user.` +
      `` +
      `Guidelines:` +
      `- Extract key demographic and psychographic information` +
      `- Identify interests, goals, and preferences` +
      `- For each question, determine if it was answered in the conversation` +
      `- Provide confidence scores for your analysis`;

    const prompt = `Conversation: ${conversation}
    
    Questions to analyze: ${questions.join(", ")}`;

    return this.generateStructuredResponse(prompt, schema, systemPrompt);
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
      `You are an expert at extracting activities for plan creation.` +
      `${userContext ? ` Context: ${userContext}` : ""}` +
      `` +
      `Guidelines:` +
      `- Extract activities mentioned in the conversation` +
      `- Use atomic measures (e.g., 'pages', 'minutes', 'kilometers', not 'books' or 'marathons')` +
      `- Only single measure per activity (Never joint measures like 'pages or minutes')` +
      `- Provide clear reasoning for each activity` +
      `- Set confidence based on clarity of information` +
      `` +
      `Examples` +
      `- 'Reading' measured in 'pages' or 'minutes'` +
      `- 'Running' measured in 'kilometers' or 'minutes'` +
      `- 'Gym' measured in 'minutes' or 'sessions'`;
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
    user: {
      name?: string | null;
      username?: string | null;
      profile?: string | null;
    },
    plan: {
      goal: string;
      emoji?: string | null;
      sessions?: any[];
      createdAt: Date;
      finishingDate?: Date | null;
    }
  ): Promise<string> {
    const userName = user.name || user.username || "there";
    const userProfile = user.profile || `User working towards: ${plan.goal}`;
    const planAge = Math.floor(
      (Date.now() - plan.createdAt.getTime()) / (24 * 60 * 60 * 1000)
    );

    // Calculate plan progress
    const totalSessions = plan.sessions?.length || 0;
    // Note: PlanSession model doesn't have completedAt field yet
    const completedSessions = 0; // Placeholder until completion tracking is implemented
    const progressPercentage =
      totalSessions > 0
        ? Math.round((completedSessions / totalSessions) * 100)
        : 0;

    // Determine time context
    let timeContext = "";
    if (plan.finishingDate) {
      const daysLeft = Math.ceil(
        (new Date(plan.finishingDate).getTime() - Date.now()) /
          (24 * 60 * 60 * 1000)
      );
      if (daysLeft > 0) {
        timeContext = `with ${daysLeft} days remaining`;
      } else if (daysLeft === 0) {
        timeContext = "on the final day";
      } else {
        timeContext = `${Math.abs(daysLeft)} days past the target date`;
      }
    }

    const systemPrompt =
      `You are an encouraging but realistic personal coach. Generate a coaching message that is:` +
      `- Personal and addresses the user by name` +
      `- Specific to their current progress and situation` +
      `- Encouraging but not overly optimistic` +
      `- Actionable with a gentle nudge toward the next step` +
      `- Warm and supportive in tone` +
      `- Brief (1-2 sentences max)` +
      `` +
      `Avoid generic motivational phrases and focus on their specific journey.`;

    const prompt =
      `Generate a coaching message for ${userName}.` +
      `` +
      `Context:` +
      `- User profile: ${userProfile}` +
      `- Plan goal: ${plan.goal}` +
      `- Plan started ${planAge} days ago` +
      `- Progress: ${completedSessions}/${totalSessions} sessions completed (${progressPercentage}%)` +
      `${timeContext ? `- Timeline: ${timeContext}` : ""}` +
      `` +
      `Create a personalized, encouraging message that acknowledges their current state and motivates them for the next step.`;

    return this.generateText(prompt, systemPrompt);
  }

  async generatePlanSessions(params: {
    goal: string;
    finishingDate?: Date;
    activities: any[];
    description?: string;
    existingPlan?: any;
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
      if (params.finishingDate) {
        finishingDate = params.finishingDate;
      } else {
        finishingDate = new Date(
          today.getTime() + DEFAULT_WEEKS * 7 * 24 * 60 * 60 * 1000
        );
      }
      const weeks = Math.ceil(
        (finishingDate.getTime() - today.getTime()) / (7 * 24 * 60 * 60 * 1000)
      );

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
          `The plan has the finishing date of ${finishingDateReadable} and today is ${todayReadableDate}.` +
          `Additional requirements:`;
      } else {
        introduction =
          `You will act as a personal coach for the goal of ${params.goal}.` +
          `The plan has the finishing date of ${finishingDateReadable} and today is ${todayReadableDate}.`;
      }

      const systemPrompt =
        `${introduction}` +
        `No date should be before today (${todayReadableDate}).` +
        `You must develop a progressive plan over the course of ${weeks} weeks.` +
        `Keep the activities to a minimum.` +
        `The plan should be progressive (intensities or recurrence of activities should increase over time).` +
        `The plan should take into account the finishing date and adjust the intensity and/or recurrence of the activities accordingly.` +
        `It is an absolute requirement that all present sessions activity names are contained in the list of activities.` +
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
          .describe("The date of the session in YYYY-MM-DD format."),
        activity_name: z
          .string()
          .describe(
            "The name of the activity to be performed. Should have no emoji to match exactly with the activity title."
          ),
        quantity: z
          .number()
          .describe(
            "The quantity of the activity to be performed. Directly related to the activity and should be measured in the same way."
          ),
        descriptive_guide: z.string(),
      });

      const GeneratedSessionWeek = z.object({
        week_number: z.number(),
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

      // Convert generated sessions to the expected format
      const sessions: Array<{
        date: Date;
        activityId: any;
        descriptive_guide: string;
        quantity: number;
      }> = [];
      for (const week of response.weeks) {
        logger.info(
          `Week ${week.week_number}. Has ${week.sessions.length} sessions.`
        );

        logger.info({ sessions: week.sessions });
        logger.info({ activities: params.activities });

        for (const session of week.sessions) {
          // Find matching activity
          const activity = params.activities.find(
            (a) => a.title.toLowerCase() === session.activity_name.toLowerCase()
          );

          if (activity) {
            sessions.push({
              date: new Date(session.date),
              activityId: activity.id,
              descriptive_guide: session.descriptive_guide,
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
}

export const aiService = new AIService();
