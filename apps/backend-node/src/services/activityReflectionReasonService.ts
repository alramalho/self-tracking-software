import { gateway } from "@ai-sdk/gateway";
import dedent from "dedent";
import { z } from "zod/v4";
import { Output, generateText } from "../utils/aiSdk";
import { logger } from "../utils/logger";

const reflectionReasonsSchema = z.object({
  reasons: z.array(z.string().min(2).max(24)).min(3).max(6),
});

type ActivityReflectionReasonInput = {
  activity: {
    title: string;
    measure: string;
    emoji?: string | null;
  };
  entry: {
    quantity: number;
    datetime: Date;
    description?: string | null;
  };
  difficulty: string;
};

function fallbackReasons(input: ActivityReflectionReasonInput): string[] {
  const title = input.activity.title.toLowerCase();
  const measure = input.activity.measure.toLowerCase();
  const reasons = new Set<string>();

  if (
    /\b(run|walk|cycle|bike|swim|km|mi|mile|steps?)\b/.test(
      `${title} ${measure}`
    )
  ) {
    reasons.add("Pace");
    reasons.add("Route");
  }

  if (
    /\b(gym|strength|workout|lift|reps?|sets?)\b/.test(`${title} ${measure}`)
  ) {
    reasons.add("Load");
    reasons.add("Form");
  }

  reasons.add("Intensity");
  reasons.add("Recovery");
  reasons.add("Time");
  reasons.add("Energy");

  return Array.from(reasons).slice(0, 6);
}

function normalizeReasons(reasons: string[]): string[] {
  const seen = new Set<string>();
  return reasons
    .map((reason) => reason.trim().replace(/\s+/g, " "))
    .filter((reason) => reason.length >= 2 && reason.length <= 24)
    .filter((reason) => {
      const key = reason.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 6);
}

export async function generateActivityReflectionReasons(
  input: ActivityReflectionReasonInput
): Promise<string[]> {
  const fallback = fallbackReasons(input);

  if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL) {
    return fallback;
  }

  try {
    const result = await generateText({
      model: gateway(
        process.env.ACTIVITY_REFLECTION_REASONS_MODEL || "openai/gpt-5.4-mini"
      ),
      output: Output.object({
        schema: reflectionReasonsSchema,
        name: "activityReflectionReasons",
        description:
          "Short selectable reasons for what a coach should know about an activity log.",
      }),
      temperature: 0.2,
      prompt: dedent`
        Generate concise reason chips for "What should your coach know?"

        Requirements:
        - Return 4 to 6 options.
        - Each option is 1 to 2 words.
        - Make options specific to the activity and log when useful.
        - Cover likely coach-relevant causes of effort: intensity, conditions, scheduling, recovery, body state, execution, blockers.
        - Avoid generic duplicates and avoid full sentences.

        Activity:
        - title: ${input.activity.title}
        - emoji: ${input.activity.emoji ?? ""}
        - measure: ${input.activity.measure}

        Log:
        - quantity: ${input.entry.quantity} ${input.activity.measure}
        - datetime: ${input.entry.datetime.toISOString()}
        - description: ${input.entry.description ?? ""}
        - perceived difficulty: ${input.difficulty}

        Return only the structured reasons.
      `,
    });

    const generated = normalizeReasons(result.output.reasons);
    return generated.length >= 3 ? generated : fallback;
  } catch (error) {
    logger.warn(
      "Activity reflection reason generation failed, using fallback",
      {
        error,
        activityTitle: input.activity.title,
        difficulty: input.difficulty,
      }
    );
    return fallback;
  }
}
