import {
  createOpenRouter,
  OpenRouterProvider,
} from "@openrouter/ai-sdk-provider";
import { generateObject } from "ai";
import { z } from "zod/v4";
import { format, startOfWeek } from "date-fns";
import dedent from "dedent";
import { logger } from "../utils/logger";
import { getCurrentUser } from "../utils/requestContext";

const DEFAULT_MAX_WEEKS = 2;

// Types - exported for use in other services
export interface ActivityInput {
  id: string;
  title: string;
  measure: string;
  emoji?: string;
}

export interface PlanGenerationParams {
  goal: string;
  activities: ActivityInput[];
  userAge: number | null;
  experience: string;
  timesPerWeek: number;
  weeks: number;
  finishingDate: Date;
  sessionsPerWeek?: number;
  maxWeeks?: number;
  researchFindings?: string;
}

export interface GeneratedSession {
  date: Date;
  activityId: string;
  descriptiveGuide: string;
  quantity: number;
  imageUrls: string[];
}

export interface PipelineResult {
  sessions: GeneratedSession[];
  // Activities used in the plan (generated from research if none provided)
  activities: ActivityInput[];
  researchFindings?: string;
}

/**
 * Two-stage plan generation pipeline:
 * 1. Activity Generator - Generates activities based on goal and research (if not provided)
 * 2. Session Generator - Creates sessions for the first N weeks (default: 2)
 *
 * Research is done externally via perplexityAiService and passed in.
 */
export class PlanGenerationPipeline {
  private openrouter: OpenRouterProvider;

  constructor() {
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY is not set");
    }

    this.openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.HELICONE_API_KEY
        ? "https://openrouter.helicone.ai/api/v1"
        : undefined,
      headers: this.getHeaders(),
    });
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    const user = getCurrentUser();

    if (process.env.HELICONE_API_KEY) {
      headers["Helicone-Auth"] = `Bearer ${process.env.HELICONE_API_KEY}`;
    }

    if (user?.id) {
      headers["Helicone-User-Id"] = user.id;
    }
    if (user?.username) {
      headers["Helicone-Property-Username"] = user.username;
    }
    if (process.env.NODE_ENV) {
      headers["Helicone-Property-Environment"] = process.env.NODE_ENV;
    }

    return headers;
  }

  /**
   * Main entry point - runs the 3-stage pipeline
   * Only generates sessions for the first N weeks (default: 2)
   * Research should be done externally via perplexityAiService and passed in.
   */
  async generatePlan(params: PlanGenerationParams): Promise<PipelineResult> {
    const maxWeeks = params.maxWeeks ?? DEFAULT_MAX_WEEKS;
    logger.info(`Starting plan generation pipeline for goal: "${params.goal}" (generating ${maxWeeks} weeks)`);

    // Use provided research findings or fall back to defaults
    const researchFindings = params.researchFindings || this.getDefaultResearchFindings(params);
    if (params.researchFindings) {
      logger.info("Using provided research findings");
    } else {
      logger.info("No research findings provided, using defaults");
    }

    // Stage 1: Generate activities based on goal and research (if not provided)
    let activities: ActivityInput[];
    if (params.activities && params.activities.length > 0) {
      activities = params.activities;
      logger.info(`Using ${activities.length} provided activities`);
    } else {
      try {
        activities = await this.generateActivities(params, researchFindings);
        logger.info(`Activity Generation completed: ${activities.length} activities`);
      } catch (error) {
        logger.error("Activity Generation failed", error);
        throw new Error("Failed to generate activities for plan");
      }
    }

    // Stage 2: Generate sessions for the first N weeks only
    let sessions: GeneratedSession[];
    try {
      sessions = await this.generateSessions(params, researchFindings, activities, maxWeeks);
      logger.info(`Session Generation completed: ${sessions.length} sessions for ${maxWeeks} weeks`);
    } catch (error) {
      logger.error("Session Generation failed", error);
      // Fall back to basic session generation
      sessions = this.generateBasicSessions(params, activities, maxWeeks);
    }

    // Stage 3: Generate images for sessions (in parallel, non-blocking)
    try {
      sessions = await this.generateSessionImages(sessions, activities);
      logger.info(`Image Generation completed for ${sessions.length} sessions`);
    } catch (error) {
      logger.warn("Image Generation failed, continuing without images", error);
      // Sessions already have empty imageUrls, so we continue
    }

    return {
      sessions,
      activities,
      researchFindings,
    };
  }

  private categorizeExperience(experience: string): string {
    const lowerExp = experience.toLowerCase();
    if (lowerExp.includes("beginner") || lowerExp.includes("never") || lowerExp.includes("new") || lowerExp.includes("starting")) {
      return "complete beginner";
    }
    if (lowerExp.includes("some") || lowerExp.includes("little") || lowerExp.includes("occasionally")) {
      return "beginner with some experience";
    }
    if (lowerExp.includes("regular") || lowerExp.includes("often") || lowerExp.includes("weekly")) {
      return "intermediate";
    }
    if (lowerExp.includes("advanced") || lowerExp.includes("years") || lowerExp.includes("experienced")) {
      return "experienced";
    }
    return "beginner"; // Default
  }

  private getDefaultResearchFindings(params: PlanGenerationParams): string {
    return dedent`
        General best practices for ${params.goal}:
        - Start slowly and build consistency
        - Progress gradually (10% increase per week rule)
        - Include rest days for recovery
        - Track progress to stay motivated
        - Focus on form before intensity
    `;
  }

  /**
   * Generate activities based on goal and research findings
   * Creates 2-4 trackable activities appropriate for the goal
   */
  private async generateActivities(
    params: PlanGenerationParams,
    researchFindings: string
  ): Promise<ActivityInput[]> {
    const { goal, userAge, experience, timesPerWeek } = params;
    const experienceLevel = this.categorizeExperience(experience);

    const ActivitiesSchema = z.object({
      activities: z.array(z.object({
        id: z.string().describe("Unique ID for the activity, format: 'new_1', 'new_2', etc."),
        title: z.string().describe("Short, concise activity name (2-3 words max)"),
        measure: z.string().describe("Unit of measurement: 'minutes', 'times', 'km', 'reps', 'pages', etc."),
        emoji: z.string().describe("Hard requirement: ONE emoji only, even if activity is allusive to multiple activities (e.g run/walk pairs)"),
      })),
    });

    const result = await generateObject({
      model: this.openrouter.chat("x-ai/grok-4.1-fast"),
      schema: ActivitiesSchema,
      system: dedent`
        You are an expert at designing trackable activities for habit plans.

        IMPORTANT GUIDELINES:
        - Generate 2-4 ACTIVE, trackable activities that directly contribute to the goal
        - Use atomic measures (e.g., 'pages', 'minutes', 'kilometers', NOT 'books' or 'marathons')
        - Do NOT include passive activities like "Rest and Recovery", "Rest days", or "Sleep"
        - Focus on activities the user will actively DO and track
        - Consider the user's experience level when choosing activity complexity
        - Each activity should be distinct and serve a different purpose toward the goal

        ACTIVITY TITLE RULES (VERY IMPORTANT):
        - Keep titles SHORT and CONCISE (2-3 words maximum)
        - Do NOT include measurement words in titles like "duration", "time", "intervals", "session", "workout"
        - The measure field already captures the unit, so don't repeat it in the title
        - Good examples: "Easy run", "Long run", "Core exercises", "Strength training", "Speed work"
        - Bad examples: "Easy run duration", "Long run time", "Core exercise session", "Threshold run intervals"
      `,
      prompt: dedent`
        Generate activities for this user:

        - Goal: "${goal}"
        - Experience: ${experienceLevel}
        - Age: ${userAge || "not specified"}
        - Target frequency: ${timesPerWeek} times per week

        Research findings to consider:
        ${researchFindings}

        Create 2-4 trackable activities that will help them achieve their goal.
        Use IDs like "new_1", "new_2", etc.
        Remember: Keep titles short (2-3 words), no measurement words like "duration" or "time".
      `,
      temperature: 0.3,
    });

    logger.info(`Generated ${result.object.activities.length} activities for goal: "${goal}"`);
    return result.object.activities;
  }

  /**
   * Generate sessions for the first N weeks
   * Creates a progressive plan limited to maxWeeks
   */
  private async generateSessions(
    params: PlanGenerationParams,
    researchFindings: string,
    activities: ActivityInput[],
    maxWeeks: number
  ): Promise<GeneratedSession[]> {
    const { goal, timesPerWeek, experience } = params;
    const experienceLevel = this.categorizeExperience(experience);

    // Calculate week start dates (only for maxWeeks)
    const weekStartDates = this.calculateWeekStartDates(maxWeeks);
    const todayStr = format(new Date(), "yyyy-MM-dd");

    const SessionsSchema = z.object({
      weeks: z.array(z.object({
        weekNumber: z.number(),
        weekStartDate: z.string(),
        sessions: z.array(z.object({
          date: z.string().describe("Session date in YYYY-MM-DD format"),
          activityId: z.string().describe("ID of the activity"),
          quantity: z.number().describe("Amount to do (in the activity's measure unit)"),
          descriptiveGuide: z.string().describe("Detailed, motivating description of this specific session - what to focus on, tips, and encouragement (2-3 sentences)"),
        })),
      })),
    });

    const result = await generateObject({
      model: this.openrouter.chat("openai/gpt-4.1-mini"),
      schema: SessionsSchema,
      system: dedent`
        You are a personal coach creating a ${maxWeeks}-week progressive plan.

        USER PROFILE (CRITICAL - MUST FOLLOW):
        - Experience level: ${experienceLevel}
        - Sessions per week: EXACTLY ${timesPerWeek} sessions

        COACHING PRINCIPLES:
        - Start VERY conservatively for a ${experienceLevel}
        - Progress gradually (10-15% increase per week)
        - Distribute ${timesPerWeek} sessions evenly throughout each week
        - Focus on building consistency over intensity

        DESCRIPTIVE GUIDE RULES:
        - Each session MUST have a detailed, personalized descriptive guide
        - 2-3 sentences explaining what to focus on, with tips for their level
        - Example: "Focus on maintaining a conversational pace throughout. This easy run builds your aerobic base - if you can't talk comfortably, slow down."

        RESEARCH-BASED GUIDELINES (use these for starting quantities):
        ${researchFindings}
      `,
      prompt: dedent`
        Create a ${maxWeeks}-week plan for a ${experienceLevel} working towards: "${goal}"

        ACTIVITIES:
        ${activities.map(a => `- ${a.title} (measured in ${a.measure}, ID: ${a.id})`).join("\n")}

        REQUIREMENTS:
        - EXACTLY ${timesPerWeek} sessions per week (no more, no less)
        - Week start dates: ${weekStartDates.join(", ")}
        - Today is ${todayStr}, schedule from today onwards
        - Spread sessions across different days

        Remember: This is a ${experienceLevel} - use appropriate starting quantities from the guidelines.
      `,
      temperature: 0.3,
    });

    // Flatten weeks into sessions array
    const sessions: GeneratedSession[] = [];
    for (const week of result.object.weeks) {
      for (const session of week.sessions) {
        sessions.push({
          date: new Date(session.date),
          activityId: session.activityId,
          quantity: session.quantity,
          descriptiveGuide: session.descriptiveGuide,
          imageUrls: [],
        });
      }
    }

    return sessions;
  }

  /**
   * Generate images for sessions using Gemini Image
   * Generates unique images per session using the descriptive guide
   * Only generates images for activities that benefit from instructive illustrations
   */
  private async generateSessionImages(
    sessions: GeneratedSession[],
    activities: ActivityInput[]
  ): Promise<GeneratedSession[]> {
    // First, check which activities would benefit from illustrations (in parallel)
    const uniqueActivityIds = [...new Set(sessions.map(s => s.activityId))];
    const activityCheckPromises = uniqueActivityIds.map(async (activityId) => {
      const activity = activities.find(a => a.id === activityId);
      if (!activity) return { activityId, shouldGenerate: false };
      const shouldGenerate = await this.shouldGenerateImageForActivity(activity);
      return { activityId, shouldGenerate };
    });

    const checkResults = await Promise.all(activityCheckPromises);
    const activitiesNeedingImages = new Set(
      checkResults.filter(r => r.shouldGenerate).map(r => r.activityId)
    );

    // Generate images for each session (in parallel)
    const sessionImagePromises = sessions.map(async (session, index) => {
      if (!activitiesNeedingImages.has(session.activityId)) {
        return { index, imageUrl: null };
      }

      const activity = activities.find(a => a.id === session.activityId);
      if (!activity) return { index, imageUrl: null };

      try {
        const imageUrl = await this.generateImageForSession(activity, session.descriptiveGuide);
        return { index, imageUrl };
      } catch (error) {
        logger.warn(`Failed to generate image for session ${index}`, error);
        return { index, imageUrl: null };
      }
    });

    const imageResults = await Promise.all(sessionImagePromises);

    // Update sessions with their images
    return sessions.map((session, index) => {
      const result = imageResults.find(r => r.index === index);
      return {
        ...session,
        imageUrls: result?.imageUrl ? [result.imageUrl] : [],
      };
    });
  }

  /**
   * Check if an activity would benefit from an instructive illustration
   * Defaults to YES for physical activities - only says NO for clearly mental tasks
   */
  private async shouldGenerateImageForActivity(activity: ActivityInput): Promise<boolean> {
    try {
      const schema = z.object({
        reasoning: z.string().describe("Thought process on whether this activity would benefit from an instructive illustration"),
        should_generate: z.boolean().describe("Whether this activity would benefit from an instructive illustration"),
      });

      const result = await generateObject({
        model: this.openrouter.chat("x-ai/grok-4.1-fast"),
        schema,
        system: dedent`
          You determine whether an activity would benefit from an educational illustration.

          DEFAULT TO YES for anything that sounds physical or could involve body movement.

          DEFINITELY YES (generate image):
          - Any exercise, training, or workout
          - Running, jogging, walking
          - Strength training, weight lifting, bodyweight exercises
          - Yoga, stretching, mobility work
          - Sports activities
          - Breathing exercises, meditation poses
          - Any activity where form/technique matters

          ONLY SAY NO for clearly non-physical activities:
          - Reading, studying, writing
          - Journaling, note-taking
          - Purely mental tasks (memorization, problem-solving)
          - Screen time, focus time

          When in doubt, say YES.
        `,
        prompt: `Activity: "${activity.title}" (measured in ${activity.measure}). Should this activity have an instructive illustration?`,
        temperature: 0,
      });

      logger.info(`Image gate for "${activity.title}": ${result.object.should_generate} - ${result.object.reasoning}`);
      return result.object.should_generate;
    } catch (error) {
      logger.warn(`Error checking if activity needs image: ${activity.title}`, error);
      // Default to true on error for physical-sounding activities
      const lowerTitle = activity.title.toLowerCase();
      return lowerTitle.includes("run") || lowerTitle.includes("train") || lowerTitle.includes("exercise") || lowerTitle.includes("workout");
    }
  }

  /**
   * Generate a single instructive illustration for a session using Gemini Image
   */
  private async generateImageForSession(
    activity: ActivityInput,
    descriptiveGuide: string
  ): Promise<string | null> {
    try {
      const prompt = dedent`
        Generate an educational illustration for ${activity.title}
        with focus on "${descriptiveGuide}"
      `;

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          ...this.getHeaders(),
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image",
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          modalities: ["image", "text"],
          image_config: {
            aspect_ratio: "4:3",
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.warn(`Image generation API error: ${response.status} - ${errorText}`);
        return null;
      }

      const result = await response.json() as {
        choices?: Array<{
          message?: {
            images?: Array<{
              image_url?: { url?: string };
            }>;
          };
        }>;
      };

      // Extract image from response
      const imageUrl = result.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (imageUrl) {
        logger.info(`Generated instructive image for session: ${activity.title}`);
        return imageUrl;
      }

      logger.warn(`No image in response for session: ${activity.title}`);
      return null;
    } catch (error) {
      logger.error(`Error generating image for session ${activity.title}:`, error);
      return null;
    }
  }

  private calculateWeekStartDates(weeks: number): string[] {
    const dates: string[] = [];
    const today = new Date();

    // Find the last Sunday (or today if Sunday)
    let currentWeekStart = startOfWeek(today, { weekStartsOn: 0 });

    for (let i = 0; i < weeks; i++) {
      dates.push(format(currentWeekStart, "yyyy-MM-dd"));
      // Move to next Sunday
      currentWeekStart = new Date(currentWeekStart);
      currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    }

    return dates;
  }

  /**
   * Fallback: Generate basic sessions without AI
   */
  private generateBasicSessions(
    params: PlanGenerationParams,
    activities: ActivityInput[],
    maxWeeks: number
  ): GeneratedSession[] {
    const sessions: GeneratedSession[] = [];
    const { timesPerWeek } = params;
    const today = new Date();

    for (let week = 0; week < maxWeeks; week++) {
      for (let sessionNum = 0; sessionNum < timesPerWeek; sessionNum++) {
        const sessionDate = new Date(today);
        sessionDate.setDate(today.getDate() + week * 7 + sessionNum * 2); // Every other day

        const activity = activities[sessionNum % activities.length];
        const progressMultiplier = 1 + week * 0.1; // 10% increase per week

        sessions.push({
          date: sessionDate,
          activityId: activity.id,
          descriptiveGuide: `Week ${week + 1}, Session ${sessionNum + 1}: Focus on ${activity.title}`,
          quantity: Math.ceil(progressMultiplier * 10), // Base quantity of 10
          imageUrls: [],
        });
      }
    }

    return sessions;
  }
}

// Export singleton instance
export const planGenerationPipeline = new PlanGenerationPipeline();
