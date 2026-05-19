import { gateway } from "@ai-sdk/gateway";
import { generateText, Output } from "ai";
import dedent from "dedent";
import { z } from "zod/v4";
import {
  ACTIVITY_CATEGORIES,
  DEFAULT_ACTIVITY_CATEGORY,
  type ActivityCategory,
} from "../constants/activityCategories";
import { logger } from "../utils/logger";
import { prisma } from "../utils/prisma";

const activityCategorySchema = z.object({
  category: z.enum(ACTIVITY_CATEGORIES),
});

export type ActivityCategoryInput = {
  title: string;
  measure: string;
  emoji?: string | null;
};

function heuristicCategory(input: ActivityCategoryInput): ActivityCategory {
  const text =
    `${input.title} ${input.measure} ${input.emoji ?? ""}`.toLowerCase();
  if (/\b(run|running|jog|jogging|treadmill|5k|10k|marathon)\b/.test(text)) {
    return "running";
  }
  return DEFAULT_ACTIVITY_CATEGORY;
}

export async function classifyActivityCategory(
  input: ActivityCategoryInput
): Promise<ActivityCategory> {
  const fallback = heuristicCategory(input);

  if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL) {
    return fallback;
  }

  try {
    const result = await generateText({
      model: gateway(
        process.env.ACTIVITY_CATEGORY_MODEL || "openai/gpt-5.4-nano"
      ),
      output: Output.object({
        schema: activityCategorySchema,
        name: "activityCategory",
        description: "The fixed category for a user-defined activity.",
      }),
      prompt: dedent`
        Classify this user-defined activity into exactly one category.

        Categories:
        - running: running, jogging, treadmill running, races, or similar run workouts.
        - other: everything else, including walking, hiking, cycling, gym workouts, meditation, habits, chores, and non-fitness activities.

        Activity:
        - title: ${input.title}
        - measure: ${input.measure}
        - emoji: ${input.emoji ?? ""}

        Return only the structured category.
      `,
    });

    return result.output.category;
  } catch (error) {
    logger.warn("Activity category classification failed, using fallback", {
      error,
      title: input.title,
      measure: input.measure,
    });
    return fallback;
  }
}

export async function classifyAndUpdateActivityCategory(activity: {
  id: string;
  title: string;
  measure: string;
  emoji?: string | null;
}): Promise<ActivityCategory> {
  const category = await classifyActivityCategory(activity);

  await prisma.activity.update({
    where: { id: activity.id },
    data: { category },
  });

  return category;
}
