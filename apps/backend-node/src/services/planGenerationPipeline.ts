import {
  createOpenRouter,
  OpenRouterProvider,
} from "@openrouter/ai-sdk-provider";
import { generateText, generateObject } from "ai";
import { z } from "zod/v4";
import { v4 as uuidv4 } from "uuid";
import { format, startOfWeek } from "date-fns";
import dedent from "dedent";
import { s3Service } from "./s3Service";
import { logger } from "../utils/logger";
import { getCurrentUser } from "../utils/requestContext";

// Types
interface ActivityInput {
  id: string;
  title: string;
  measure: string;
  emoji?: string;
}

interface AdaptedActivity {
  // For existing activities: the original ID. For new activities: a temp ID like "new_1"
  id: string;
  title: string;
  measure: string;
  emoji?: string;
  // Whether this is a new activity that needs to be created in DB
  isNew: boolean;
  // If adapted from an original activity, reference it
  originalId: string | null;
  // Reason for the adaptation/addition
  reason: string | null;
}

interface PlanGenerationParams {
  goal: string;
  activities: ActivityInput[];
  userAge: number | null;
  experience: string;
  timesPerWeek: number;
  weeks: number;
  finishingDate: Date;
  sessionsPerWeek?: number;
}

interface GeneratedSession {
  date: Date;
  activityId: string;
  descriptiveGuide: string;
  quantity: number;
  imageUrls: string[];
}

interface PipelineResult {
  sessions: GeneratedSession[];
  // The adapted activities - may include new activities with isNew=true
  adaptedActivities: AdaptedActivity[];
  researchFindings?: string;
  coachPrompt?: string;
}

/**
 * Four-stage plan generation pipeline:
 * 1. Researcher - Searches for best practices using Perplexity
 * 2. Activity Adapter - Adapts/adds/removes activities based on research
 * 3. Prompt Crafter - Creates a custom system prompt based on research
 * 4. Session Generator - Creates sessions with optional AI-generated images
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
   * Main entry point - runs the full 4-stage pipeline
   */
  async generatePlan(params: PlanGenerationParams): Promise<PipelineResult> {
    logger.info(`Starting plan generation pipeline for goal: "${params.goal}"`);

    // Stage 1: Research best practices
    let researchFindings: string;
    try {
      researchFindings = await this.stage1Research(params);
      logger.info("Stage 1 (Research) completed successfully");
    } catch (error) {
      logger.warn("Stage 1 (Research) failed, using fallback", error);
      researchFindings = this.getDefaultResearchFindings(params);
    }

    // Stage 2: Adapt activities based on research
    let adaptedActivities: AdaptedActivity[];
    try {
      adaptedActivities = await this.stage2AdaptActivities(params, researchFindings);
      logger.info(`Stage 2 (Activity Adaptation) completed: ${adaptedActivities.length} activities`);
    } catch (error) {
      logger.warn("Stage 2 (Activity Adaptation) failed, using original activities", error);
      // Fall back to original activities
      adaptedActivities = params.activities.map(a => ({
        ...a,
        isNew: false,
        originalId: null,
        reason: null,
      }));
    }

    // Stage 3: Craft the coach prompt (using adapted activities)
    let coachPrompt: string;
    try {
      coachPrompt = await this.stage3CraftPrompt(params, researchFindings, adaptedActivities);
      logger.info("Stage 3 (Prompt Crafting) completed successfully");
    } catch (error) {
      logger.warn("Stage 3 (Prompt Crafting) failed, using fallback", error);
      coachPrompt = this.getDefaultCoachPrompt(params, adaptedActivities);
    }

    // Stage 4: Generate sessions with images (using adapted activities)
    let sessions: GeneratedSession[];
    try {
      sessions = await this.stage4GenerateSessions(params, coachPrompt, adaptedActivities);
      logger.info(`Stage 4 (Session Generation) completed: ${sessions.length} sessions`);
    } catch (error) {
      logger.error("Stage 4 (Session Generation) failed", error);
      // Fall back to basic session generation without images
      sessions = this.generateBasicSessions(params, adaptedActivities);
    }

    return {
      sessions,
      adaptedActivities,
      researchFindings,
      coachPrompt,
    };
  }

  /**
   * STAGE 1: Research best practices using Perplexity
   */
  private async stage1Research(params: PlanGenerationParams): Promise<string> {
    const { goal, userAge, experience, timesPerWeek, weeks } = params;

    const searchQuery = this.buildSearchQuery(goal, userAge, experience, timesPerWeek, weeks);

    // Try with retry
    const executeWithRetry = async (retryCount = 0): Promise<string> => {
      try {
        const result = await generateText({
          model: this.openrouter.chat("perplexity/sonar-pro"),
          prompt: searchQuery,
          system: dedent`
            You are a research assistant helping create personalized training plans.
            Search for practical advice from Reddit communities, fitness forums, and expert sources.
            Focus on:
            - Progression strategies for the user's experience level
            - Common mistakes beginners make
            - Recommended weekly structures
            - Tips specific to the goal type
            Provide concise, actionable findings.
          `,
        });

        return result.text;
      } catch (error) {
        if (retryCount === 0) {
          logger.warn("Perplexity search failed, retrying once...");
          return executeWithRetry(1);
        }
        throw error;
      }
    };

    return executeWithRetry();
  }

  private buildSearchQuery(
    goal: string,
    userAge: number | null,
    experience: string,
    timesPerWeek: number,
    weeks: number
  ): string {
    const ageContext = userAge ? `${userAge}-year-old` : "";
    const experienceLevel = this.categorizeExperience(experience);

    return dedent`
        Best practices and progression tips for ${ageContext} ${experienceLevel} wanting to "${goal}"
        training ${timesPerWeek} times per week over ${weeks} weeks.
        Include advice from Reddit communities and fitness experts.
        What are common mistakes to avoid? What's an ideal progression schedule?
    `;
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
   * STAGE 2: Generate or adapt activities based on research findings
   * - If no activities provided: Generate activities from scratch based on goal + research
   * - If activities provided: Adapt them (add, remove, specialize)
   */
  private async stage2AdaptActivities(
    params: PlanGenerationParams,
    researchFindings: string
  ): Promise<AdaptedActivity[]> {
    const { goal, userAge, experience, activities, timesPerWeek } = params;
    const hasExistingActivities = activities && activities.length > 0;

    const AdaptedActivitiesSchema = z.object({
      activities: z.array(z.object({
        // For existing activities: use the original ID
        // For new activities: use format "new_1", "new_2", etc.
        id: z.string(),
        title: z.string(),
        measure: z.string().describe("Unit of measurement: 'minutes', 'times', 'km', 'reps', etc."),
        emoji: z.string(),
        isNew: z.boolean().describe("true if this is a new activity not in the original list"),
        originalId: z.string().nullable().describe("If this activity was adapted from an original, include its ID. Otherwise null."),
        reason: z.string().nullable().describe("Brief reason for adding/adapting this activity. Can be null."),
      })),
      removedActivityIds: z.array(z.string()).nullable().describe("IDs of original activities that should be removed. Null if none removed."),
      adaptationSummary: z.string().describe("Brief summary of changes made to the activity list"),
    });

    // Different system prompts for generating vs adapting
    const systemPrompt = hasExistingActivities
      ? dedent`
        You are an expert at designing optimal training/practice plans.
        Based on research findings, you adapt the user's chosen activities to maximize their success.

        You can:
        1. KEEP activities that are well-suited for the goal
        2. SPECIALIZE generic activities (e.g., "Meditation" → "Vipassana Body Scan Meditation")
        3. ADD complementary activities that research shows are beneficial (e.g., add "Stretching" to a running plan)
        4. REMOVE activities that research suggests are inappropriate for the user's level or goal

        Be thoughtful but not excessive - only make changes that are clearly beneficial based on the research.
        `
      : dedent`
      You are an expert at designing optimal training/practice plans.
      Based on research findings, you CREATE the ideal set of activities for the user's goal.

      IMPORTANT GUIDELINES:
      - Generate 2-4 ACTIVE, trackable activities that will help achieve the goal
      - Use atomic measures (e.g., 'pages', 'minutes', 'kilometers', NOT 'books' or 'marathons')
      - Do NOT include passive activities like "Rest and Recovery", "Rest days", or "Sleep"
      - Focus on activities the user will actively DO and track
      - Consider the user's experience level when choosing activity types
      - All activities should be marked as isNew: true with IDs like "new_1", "new_2", etc.
        `;

    const userPrompt = hasExistingActivities
      ? dedent`
        USER PROFILE:
        - Goal: "${goal}"
        - Age: ${userAge || "not specified"}
        - Experience: "${experience}"

        ORIGINAL ACTIVITIES SELECTED BY USER:
        ${activities.map(a => `- ${a.title} (${a.measure}, ID: ${a.id}, emoji: ${a.emoji || "🎯"})`).join("\n")}

        RESEARCH FINDINGS:
        ${researchFindings}

        Based on the research, adapt the activity list to maximize the user's success.
        Keep changes meaningful - don't change things just for the sake of it.
        For new activities, use IDs like "new_1", "new_2", etc.
                `
              : dedent`
        USER PROFILE:
        - Goal: "${goal}"
        - Age: ${userAge || "not specified"}
        - Experience: "${experience}"
        - Target frequency: ${timesPerWeek} times per week

        RESEARCH FINDINGS:
        ${researchFindings}

        Based on the research, generate the optimal set of activities for this user.
        Create 2-4 active, trackable activities that will help them achieve their goal.
        All activities should be marked as isNew: true with IDs like "new_1", "new_2", etc.
        `;

    const result = await generateObject({
      model: this.openrouter.chat("openai/gpt-4.1-mini"),
      schema: AdaptedActivitiesSchema,
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.3,
    });

    logger.debug(`Activity ${hasExistingActivities ? 'adaptation' : 'generation'}: ${result.object.adaptationSummary}`);

    if (result.object.removedActivityIds?.length) {
      logger.info(`Removed activities: ${result.object.removedActivityIds.join(", ")}`);
    }

    return result.object.activities;
  }

  /**
   * STAGE 3: Craft a custom coach system prompt based on research
   */
  private async stage3CraftPrompt(
    params: PlanGenerationParams,
    researchFindings: string,
    adaptedActivities: AdaptedActivity[]
  ): Promise<string> {
    const { goal, userAge, experience, timesPerWeek, weeks } = params;

    const result = await generateText({
      model: this.openrouter.chat("openai/gpt-4.1-mini"),
      system: dedent`
        You are an expert at creating coaching personas and methodologies.
        Your task is to synthesize research findings into a clear, actionable system prompt for a session generator.
        The prompt should define:
        1. The coach's persona and methodology (based on what works best for this goal type)
        2. Specific progression rules tailored to the user
        3. What to focus on each week
        4. Any safety guidelines or common mistakes to avoid
      `,
      prompt: dedent`
        Create a detailed system prompt for a session generator coach.

        USER PROFILE:
        - Goal: "${goal}"
        - Age: ${userAge || "not specified"}
        - Current experience: "${experience}"
        - Target: ${timesPerWeek} sessions per week for ${weeks} weeks
        - Activities: ${adaptedActivities.map(a => `${a.title} (${a.measure})`).join(", ")}

        RESEARCH FINDINGS:
        ${researchFindings}

        Generate a system prompt that will guide the session generator to create an optimal, progressive plan.
        The prompt should be specific and actionable, not generic.
        Include specific quantity progressions based on the research.
      `,
    });

    return result.text;
  }

  private getDefaultCoachPrompt(params: PlanGenerationParams, adaptedActivities: AdaptedActivity[]): string {
    return dedent`
      You are a personal coach helping someone achieve "${params.goal}".

      USER PROFILE:
      - Age: ${params.userAge || "not specified"}
      - Experience: ${params.experience}
      - Target: ${params.timesPerWeek} sessions per week

      COACHING APPROACH:
      - Start conservatively and build gradually
      - Increase intensity/duration by ~10% per week
      - Include variety to prevent boredom
      - Focus on consistency over intensity
      - Provide clear, actionable session descriptions
    `;
  }

  /**
   * STAGE 4: Generate sessions using an agent with image generation capability
   */
  private async stage4GenerateSessions(
    params: PlanGenerationParams,
    coachPrompt: string,
    adaptedActivities: AdaptedActivity[]
  ): Promise<GeneratedSession[]> {
    const { goal, weeks, timesPerWeek, finishingDate } = params;

    // Calculate week start dates
    const weekStartDates = this.calculateWeekStartDates(weeks);
    const todayStr = format(new Date(), "yyyy-MM-dd");

    // Build the session generation prompt
    const sessionPrompt = dedent`
          Generate a ${weeks}-week progressive training plan.

      ACTIVITIES AVAILABLE:
      ${adaptedActivities.map(a => `- ${a.title} (measured in ${a.measure}, ID: ${a.id})`).join("\n")}

      SCHEDULE:
      - ${timesPerWeek} sessions per week
      - Week start dates: ${weekStartDates.join(", ")}
      - Today is ${todayStr}, so no sessions before this date
      - Plan ends: ${format(finishingDate, "yyyy-MM-dd")}

      INSTRUCTIONS:
      1. Create progressive sessions across all ${weeks} weeks
      2. Distribute sessions evenly throughout each week
      3. Increase intensity/quantity gradually week over week
      4. For activities that involve specific forms, poses, or techniques (like yoga, gym exercises, meditation positions), use the generate_image tool to create helpful visual references
      5. Make descriptive guides specific and actionable
  `;

    const SessionsSchema = z.object({
      sessions: z.array(z.object({
        date: z.string().describe("The date of the session in YYYY-MM-DD format. Must be one of the week start dates."),
        activityId: z.string().describe("The ID of the activity to be performed."),
        quantity: z.number().describe("The quantity of the activity to be performed. Directly related to the activity and should be measured in the same way."),
        descriptiveGuide: z.string().describe("A clear description of what to do for this session."),
        shouldGenerateImage: z.boolean().describe("Whether to generate an image for this session. Set to true for activities with specific forms/poses/techniques."),
        imagePrompt: z.string().nullable().describe("A prompt for the image generation model. Required if shouldGenerateImage is true, otherwise null."),
      })),
    });

    // Generate the session schedule
    const result = await generateObject({
      model: this.openrouter.chat("openai/gpt-4.1-mini"),
      schema: SessionsSchema,
      system: coachPrompt,
      prompt: sessionPrompt,
      temperature: 0.3,
    });

    // Process sessions and generate images where needed
    const sessionsWithImages: GeneratedSession[] = [];

    for (const session of result.object.sessions) {
      const imageUrls: string[] = [];

      // Generate image if requested
      if (session.shouldGenerateImage && session.imagePrompt) {
        try {
          const imageResult = await this.generateSessionImage(session.imagePrompt, "illustration");
          if (imageResult.imageUrl) {
            imageUrls.push(imageResult.imageUrl);
          }
        } catch (error) {
          logger.warn(`Failed to generate image for session: ${error}`);
          // Continue without image
        }
      }

      sessionsWithImages.push({
        date: new Date(session.date),
        activityId: session.activityId,
        quantity: session.quantity,
        descriptiveGuide: session.descriptiveGuide,
        imageUrls,
      });
    }

    return sessionsWithImages;
  }

  /**
   * Generate an image using Google's Nano Banana Pro model
   */
  private async generateSessionImage(
    prompt: string,
    style: string
  ): Promise<{ imageUrl: string | null }> {
    try {
      const fullPrompt = `Create a ${style} of: ${prompt}.
Style: Clean, instructional, suitable for a fitness/wellness app.
No text overlays. Clear demonstration of the position/technique.`;

      const result = await generateText({
        model: this.openrouter.chat("google/gemini-3-pro-image-preview"),
        prompt: fullPrompt,
      });

      // Check if files were returned (image generation)
      if ((result as any).files && (result as any).files.length > 0) {
        const imageBuffer = (result as any).files[0];
        const key = `sessions/${uuidv4()}.png`;
        await s3Service.upload(Buffer.from(imageBuffer), key, "image/png");
        const publicUrl = s3Service.getPublicUrl(key);
        return { imageUrl: publicUrl };
      }

      logger.debug("No image generated from model response");
      return { imageUrl: null };
    } catch (error) {
      logger.error("Image generation failed:", error);
      return { imageUrl: null };
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
   * Fallback: Generate basic sessions without images or research
   */
  private generateBasicSessions(params: PlanGenerationParams, adaptedActivities: AdaptedActivity[]): GeneratedSession[] {
    const sessions: GeneratedSession[] = [];
    const { weeks, timesPerWeek } = params;
    const today = new Date();

    for (let week = 0; week < weeks; week++) {
      for (let sessionNum = 0; sessionNum < timesPerWeek; sessionNum++) {
        const sessionDate = new Date(today);
        sessionDate.setDate(today.getDate() + week * 7 + sessionNum * 2); // Every other day

        const activity = adaptedActivities[sessionNum % adaptedActivities.length];
        const progressMultiplier = 1 + week * 0.1; // 10% increase per week

        sessions.push({
          date: sessionDate,
          activityId: activity.id,
          descriptiveGuide: `Week ${week + 1}, Session ${sessionNum + 1}: Focus on ${activity.title}`,
          quantity: Math.ceil(progressMultiplier * (sessionNum + 1)),
          imageUrls: [],
        });
      }
    }

    return sessions;
  }
}

// Export singleton instance
export const planGenerationPipeline = new PlanGenerationPipeline();
