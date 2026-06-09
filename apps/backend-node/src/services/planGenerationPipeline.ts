import {
  createOpenRouter,
  OpenRouterProvider,
} from "@openrouter/ai-sdk-provider";
import { createGateway, generateImage, generateObject } from "../utils/aiSdk";
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
  kind?: string;
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
  imagePrompts: string[];
  imageUrls: string[];
}

export interface PipelineTraceStep {
  stage: string;
  model: string;
  prompt: string;
  systemPrompt?: string;
  response: unknown;
  durationMs: number;
}

export interface PipelineResult {
  sessions: GeneratedSession[];
  // Activities used in the plan (generated from research if none provided)
  activities: ActivityInput[];
  researchFindings?: string;
  trace: PipelineTraceStep[];
  // Resolves when background image generation completes (sessions mutated in place)
  imageGeneration: Promise<void>;
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
    const trace: PipelineTraceStep[] = [];
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
      trace.push({ stage: "activity-generation", model: "skipped (provided)", prompt: "", response: activities, durationMs: 0 });
    } else {
      try {
        activities = await this.generateActivities(params, researchFindings, trace);
        logger.info(`Activity Generation completed: ${activities.length} (${activities.map(a => `${a.title} (${a.measure})`).join(", ")}) activities`);
      } catch (error) {
        logger.error("Activity Generation failed", error);
        throw new Error("Failed to generate activities for plan");
      }
    }

    // Stage 2: Generate sessions for the first N weeks only
    let sessions: GeneratedSession[];
    try {
      sessions = await this.generateSessions(params, researchFindings, activities, maxWeeks, trace);
      logger.info(`Session Generation completed: ${sessions.length} sessions for ${maxWeeks} weeks`);
    } catch (error) {
      logger.error("Session Generation failed", error);
      // Fall back to basic session generation
      sessions = this.generateBasicSessions(params, activities, maxWeeks);
    }

    // Stage 3: Generate images from coach-provided imagePrompts
    // Returns immediately with imageUrls empty — caller can await imageGeneration if needed
    const imageGeneration = this.generateImagesFromPrompts(sessions, activities, trace)
      .then((updated) => {
        // Mutate sessions in place so the trace upload picks them up
        for (let i = 0; i < updated.length; i++) {
          sessions[i].imageUrls = updated[i].imageUrls;
        }
        logger.info(`Image Generation completed for ${sessions.length} sessions`);
      })
      .catch((error) => {
        logger.warn("Image Generation failed, continuing without images", error);
      });

    return {
      sessions,
      activities,
      researchFindings,
      trace,
      imageGeneration,
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
    researchFindings: string,
    trace: PipelineTraceStep[]
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

    const activityModel = "x-ai/grok-4.1-fast";
    const activitySystem = dedent`
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
      `;
    const activityPrompt = dedent`
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
      `;

    const t0 = Date.now();
    const result = await generateObject({
      model: this.openrouter.chat(activityModel),
      schema: ActivitiesSchema,
      system: activitySystem,
      prompt: activityPrompt,
      temperature: 0.3,
    });
    trace.push({ stage: "activity-generation", model: activityModel, systemPrompt: activitySystem, prompt: activityPrompt, response: result.object, durationMs: Date.now() - t0 });

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
    maxWeeks: number,
    trace: PipelineTraceStep[]
  ): Promise<GeneratedSession[]> {
    const { goal, timesPerWeek, experience } = params;
    const experienceLevel = this.categorizeExperience(experience);

    // Calculate week start dates (only for maxWeeks)
    const weekStartDates = this.calculateWeekStartDates(maxWeeks);
    const todayStr = format(new Date(), "yyyy-MM-dd");

    // Build a single enum where each option is a complete activity string
    // Format: "id::title::measure" - this forces the AI to pick a valid combination
    const activityOptions = activities.map(a => `${a.id}::${a.title}::${a.measure}`) as [string, ...string[]];

    // Build display string for the prompt to help AI understand the options
    const activityDisplayList = activities
      .map(a => `- "${a.id}::${a.title}::${a.measure}" (quantity in ${a.measure})`)
      .join("\n");

    const SessionsSchema = z.object({
      weeks: z.array(z.object({
        weekNumber: z.number(),
        weekStartDate: z.string(),
        sessions: z.array(z.object({
          date: z.string().describe("Session date in YYYY-MM-DD format"),
          activity: z.enum(activityOptions).describe(`Pick one of the available activities. The format is "id::title::measure". The measure tells you what unit to use for quantity.`),
          quantity: z.number().describe("Amount in the measure unit from the activity you picked. For 'minutes': 15-60 for beginners. For 'miles': 1-5 for beginners. For 'km': 2-8 for beginners."),
          descriptiveGuide: z.string().describe("2-3 sentences. Reference the quantity with correct measure (e.g. 'This 20-minute session...' or 'These 3 miles...')."),
          imagePrompts: z.array(z.string()).describe("0-2 prompts for generating accompanying visual aids for this session. Each prompt should describe a specific illustration that adds visual information the text cannot — e.g. body posture/form, movement phases, breathing patterns, progression visualization. Leave empty if the session doesn't benefit from visuals (e.g. reading, journaling). Do NOT repeat the session description as text in the image — the image should show what words can't."),
        })),
      })),
    });

    const sessionModel = "openai/gpt-5.2-chat";
    const sessionSystem = dedent`
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

        IMAGE PROMPTS (optional visual aids):
        - For each session, decide if 0-2 accompanying illustrations would help the user
        - Good image prompts describe visuals that ADD information beyond the text: proper form/posture diagrams, movement phase illustrations, breathing pattern visuals, technique breakdowns
        - Skip images for sessions where visuals don't help (reading, journaling, rest)
        - Each prompt should be a self-contained image generation instruction
        - Style: clean instructional illustration, minimal background, annotated form cues with arrows. No text banners or motivational slogans in the image

        RESEARCH-BASED GUIDELINES (use these for starting quantities):
        ${researchFindings}
      `;
    const sessionPrompt = dedent`
        Create a ${maxWeeks}-week plan for a ${experienceLevel} working towards: "${goal}"

        AVAILABLE ACTIVITIES (pick from these exact values):
        ${activityDisplayList}

        REQUIREMENTS:
        - EXACTLY ${timesPerWeek} sessions per week (no more, no less)
        - Week start dates: ${weekStartDates.join(", ")}
        - Today is ${todayStr}, schedule from today onwards
        - Spread sessions across different days
        - quantity MUST be appropriate for the measure in the activity you picked

        Remember: This is a ${experienceLevel} - use appropriate starting quantities from the guidelines.
      `;

    const t0 = Date.now();
    const result = await generateObject({
      model: this.openrouter.chat(sessionModel),
      schema: SessionsSchema,
      system: sessionSystem,
      prompt: sessionPrompt,
      temperature: 0.3,
    });
    trace.push({ stage: "session-generation", model: sessionModel, systemPrompt: sessionSystem, prompt: sessionPrompt, response: result.object, durationMs: Date.now() - t0 });

    // Flatten weeks into sessions array, parsing the "id::title::measure" format
    const sessions: GeneratedSession[] = [];
    for (const week of result.object.weeks) {
      for (const session of week.sessions) {
        // Parse "id::title::measure" format
        const [activityId] = session.activity.split("::");
        sessions.push({
          date: new Date(session.date),
          activityId,
          quantity: session.quantity,
          descriptiveGuide: session.descriptiveGuide,
          imagePrompts: session.imagePrompts || [],
          imageUrls: [],
        });
      }
    }

     return sessions;
  }

  /**
   * Generate images from coach-provided imagePrompts (in parallel)
   */
  private async generateImagesFromPrompts(
    sessions: GeneratedSession[],
    activities: ActivityInput[],
    trace: PipelineTraceStep[]
  ): Promise<GeneratedSession[]> {
    const t0 = Date.now();

    const jobs: { si: number; pi: number; prompt: string; kind?: string }[] = [];
    for (let si = 0; si < sessions.length; si++) {
      const activity = activities.find(a => a.id === sessions[si].activityId);
      for (let pi = 0; pi < sessions[si].imagePrompts.length; pi++) {
        jobs.push({ si, pi, prompt: sessions[si].imagePrompts[pi], kind: activity?.kind });
      }
    }

    if (jobs.length === 0) {
      trace.push({ stage: "image-generation", model: "skipped", prompt: "no imagePrompts from coach", response: [], durationMs: 0 });
      return sessions;
    }

    const results = await Promise.all(
      jobs.map(async (job) => {
        try {
          const imageUrl = await this.generateImage(job.prompt, job.kind);
          return { ...job, imageUrl };
        } catch (error) {
          logger.warn(`Failed to generate image for session ${job.si} prompt ${job.pi}`, error);
          return { ...job, imageUrl: null as string | null };
        }
      })
    );

    trace.push({
      stage: "image-generation",
      model: "openai/gpt-image-2 (low/medium by kind)",
      prompt: `${jobs.length} images from coach prompts`,
      response: results.map(r => ({ session: r.si, kind: r.kind, prompt: r.prompt, hasImage: !!r.imageUrl })),
      durationMs: Date.now() - t0,
    });

    const imagesBySession = new Map<number, string[]>();
    for (const r of results) {
      if (!r.imageUrl) continue;
      const urls = imagesBySession.get(r.si) || [];
      urls.push(r.imageUrl);
      imagesBySession.set(r.si, urls);
    }

    return sessions.map((session, i) => ({
      ...session,
      imageUrls: imagesBySession.get(i) || [],
    }));
  }

  // Gym/boxing/bouldering need medium quality for form detail, everything else is fine at low
  private static MEDIUM_QUALITY_KINDS = new Set(["gym"]);

  private async generateImage(prompt: string, kind?: string): Promise<string | null> {
    const quality = PlanGenerationPipeline.MEDIUM_QUALITY_KINDS.has(kind || "") ? "medium" : "low";
    const apiKey = process.env.AI_GATEWAY_API_KEY;
    if (!apiKey) {
      logger.warn("AI_GATEWAY_API_KEY not set, skipping image generation");
      return null;
    }

    const gw = createGateway({ apiKey });

    const result = await generateImage({
      model: gw.imageModel("openai/gpt-image-2"),
      prompt,
      size: "1024x1024",
      providerOptions: { openai: { quality } },
    });

    const img = result.images[0];
    if (!img) return null;

    if (img.base64) {
      return `data:image/png;base64,${img.base64}`;
    }
    if (img.uint8Array) {
      return `data:image/png;base64,${Buffer.from(img.uint8Array).toString("base64")}`;
    }

    return null;
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
          imagePrompts: [],
          imageUrls: [],
        });
      }
    }

    return sessions;
  }
}

// Export singleton instance
export const planGenerationPipeline = new PlanGenerationPipeline();
