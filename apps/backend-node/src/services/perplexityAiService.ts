import Perplexity from "@perplexity-ai/perplexity_ai";
import { generateObject, generateText } from "ai";
import {
  createOpenRouter,
  OpenRouterProvider,
} from "@openrouter/ai-sdk-provider";
import dedent from "dedent";
import { z } from "zod/v4";
import { logger } from "../utils/logger";
import { getCurrentUser } from "../utils/requestContext";

export interface ResearchParams {
  goal: string;
  experience: string;
  timesPerWeek: number;
  userAge?: number | null;
}

export interface ResearchResult {
  findings: string;
  guidelines: string;
  estimatedWeeks: number | null; // null for ongoing/lifestyle goals, number for milestone goals
}

class PerplexityAiService {
  private perplexity: Perplexity | null = null;
  private openrouter: OpenRouterProvider;

  constructor() {
    if (process.env.PERPLEXITY_API_KEY) {
      this.perplexity = new Perplexity({
        apiKey: process.env.PERPLEXITY_API_KEY,
      });
    } else {
      logger.warn("PERPLEXITY_API_KEY not set - research will use fallback");
    }

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

  private categorizeExperience(experience: string): string {
    const lowerExp = experience.toLowerCase();
    if (
      lowerExp.includes("beginner") ||
      lowerExp.includes("never") ||
      lowerExp.includes("new") ||
      lowerExp.includes("starting")
    ) {
      return "complete beginner";
    }
    if (
      lowerExp.includes("some") ||
      lowerExp.includes("little") ||
      lowerExp.includes("occasionally")
    ) {
      return "beginner with some experience";
    }
    if (
      lowerExp.includes("regular") ||
      lowerExp.includes("often") ||
      lowerExp.includes("weekly")
    ) {
      return "intermediate";
    }
    if (
      lowerExp.includes("advanced") ||
      lowerExp.includes("years") ||
      lowerExp.includes("experienced")
    ) {
      return "experienced";
    }
    return "beginner"; // Default
  }

  /**
   * Research best practices using Perplexity Search API
   * Returns both raw findings and synthesized guidelines
   */
  async researchPlan(params: ResearchParams): Promise<ResearchResult> {
    const { goal, experience, timesPerWeek, userAge } = params;
    const experienceLevel = this.categorizeExperience(experience);
    const ageContext = userAge ? `${userAge} year old` : "";

    // Build search queries for comprehensive research
    const searchQueries = [
      `${experienceLevel} ${goal} progression plan reddit`,
      `${goal} beginner mistakes to avoid tips`,
      `${goal} ${timesPerWeek} times per week training schedule`,
    ];

    let findings = "";

    // If Perplexity client is available, use real Search API
    if (this.perplexity) {
      try {
        const searchResults = await this.perplexity.search.create({
          query: searchQueries,
          max_results: 10,
          max_tokens_per_page: 1024,
        });

        // Compile research findings from search results
        const rawFindings: string[] = [];
        for (const result of searchResults.results) {
          if (result.snippet) {
            rawFindings.push(
              `Source: ${result.title}\n${result.snippet.substring(0, 500)}`
            );
          }
        }

        if (rawFindings.length > 0) {
          findings = rawFindings.slice(0, 5).join("\n\n---\n\n");
          logger.info(
            `Perplexity research completed with ${rawFindings.length} sources`
          );
        }
      } catch (error) {
        logger.warn("Perplexity Search API failed, falling back", error);
      }
    }

    // If no findings from Perplexity, use default
    if (!findings) {
      findings = this.getDefaultFindings(goal);
      logger.info("Using fallback research findings (no Perplexity API)");
    }

    // Synthesize findings into actionable guidelines and estimate duration in parallel
    const [guidelines, estimatedWeeks] = await Promise.all([
      this.synthesizeGuidelines({
        goal,
        experienceLevel,
        ageContext,
        timesPerWeek,
        findings,
      }),
      this.estimateDuration({
        goal,
        experienceLevel,
        timesPerWeek,
      }),
    ]);

    return {
      findings,
      guidelines,
      estimatedWeeks,
    };
  }

  private getDefaultFindings(goal: string): string {
    return dedent`
      General best practices for ${goal}:
      - Start slowly and build consistency
      - Progress gradually (10% increase per week rule)
      - Include rest days for recovery
      - Track progress to stay motivated
      - Focus on form before intensity
    `;
  }

  private async synthesizeGuidelines(params: {
    goal: string;
    experienceLevel: string;
    ageContext: string;
    timesPerWeek: number;
    findings: string;
  }): Promise<string> {
    const { goal, experienceLevel, ageContext, timesPerWeek, findings } =
      params;

    try {
      const synthesis = await generateText({
        model: this.openrouter.chat("openai/gpt-4.1-mini"),
        system: dedent`
          You are a coach synthesizing research findings into actionable guidelines.
          Extract the most relevant and practical information for the user's specific situation.

          CRITICAL REQUIREMENTS:
          1. ALWAYS include specific STARTING quantities appropriate for their experience level
          2. For complete beginners, starting quantities must be VERY conservative
          3. Include specific numbers for Week 1 and Week 2

          ACTIVITY SUGGESTIONS (IMPORTANT):
          - Based on the research, suggest specific activities with their appropriate measure
          - Each activity needs: name, measure (minutes/km/reps/etc), and Week 1 starting quantity
          - Example format: "Easy run (minutes): 15-20 min" or "Long run (km): 3-5 km"

          Be concise and actionable. The plan generator will use these guidelines to create sessions.
        `,
        prompt: dedent`
          USER PROFILE:
          - Goal: "${goal}"
          - Experience level: ${experienceLevel}
          - Age: ${ageContext || "not specified"}
          - Frequency: ${timesPerWeek} sessions per week

          Research findings:
          ${findings}

          CRITICAL: The user is a "${experienceLevel}" doing ${timesPerWeek}x/week.

          Provide guidelines with:
          1. SUGGESTED ACTIVITIES: List each activity with its measure and Week 1 starting quantity
          2. Week 2 progression for each activity
          3. How to distribute ${timesPerWeek} sessions across the week
        `,
      });

      return synthesis.text;
    } catch (error) {
      logger.error("Error synthesizing guidelines:", error);
      return dedent`
        Guidelines for ${goal} (${experienceLevel}):
        - Start with ${timesPerWeek} sessions per week
        - Week 1: Begin with very short/easy sessions (10-15 minutes or minimal distance)
        - Week 2: Increase by 10-15% from Week 1
        - Progress gradually (10% per week max)
        - Focus on consistency over intensity
      `;
    }
  }

  /**
   * Estimate how many weeks it will take to achieve the goal
   * Returns null for ongoing/lifestyle goals that don't have a clear endpoint
   */
  private async estimateDuration(params: {
    goal: string;
    experienceLevel: string;
    timesPerWeek: number;
  }): Promise<number | null> {
    const { goal, experienceLevel, timesPerWeek } = params;

    try {
      const { object } = await generateObject({
        model: this.openrouter.chat("openai/gpt-5.2-chat"),
        schema: z.object({
          isMilestoneGoal: z.boolean().describe("Whether this goal has a clear endpoint (true) or is ongoing/lifestyle (false)"),
          estimatedWeeks: z.number().nullable().describe("Estimated weeks to achieve the goal, or null if ongoing"),
          reasoning: z.string().describe("Brief explanation of the estimate"),
        }),
        system: dedent`
          You estimate how long it takes to achieve fitness/habit goals.

          Consider:
          - The specific goal (marathon vs 5k vs "get fit")
          - Experience level (beginners need more time)
          - Training frequency (more sessions = potentially faster progress, but also need recovery)

          MILESTONE GOALS (have clear endpoints):
          - "Run a marathon" → 16-24 weeks for intermediate, 24-36 weeks for beginner
          - "Run a 5k" → 6-10 weeks for beginner
          - "Read 50 books" → depends on pace
          - "Lose 20 lbs" → 20-40 weeks typically

          ONGOING GOALS (no clear endpoint, return null):
          - "Get healthier"
          - "Build a running habit"
          - "Stay fit"
          - "Exercise regularly"
        `,
        prompt: dedent`
          Goal: "${goal}"
          Experience: ${experienceLevel}
          Training frequency: ${timesPerWeek}x per week

          Is this a milestone goal with a clear endpoint? If yes, estimate weeks needed.
        `,
        temperature: 0,
      });

      logger.info(`Duration estimate for "${goal}": ${object.estimatedWeeks} weeks (${object.reasoning})`);
      return object.estimatedWeeks;
    } catch (error) {
      logger.warn("Error estimating duration:", error);
      return null;
    }
  }
}

export const perplexityAiService = new PerplexityAiService();
