import { gateway } from "@ai-sdk/gateway";
import { generateText, Output } from "ai";
import dedent from "dedent";
import { z } from "zod/v4";
import {
  ACTIVITY_KINDS,
  DEFAULT_ACTIVITY_KIND,
  type ActivityKind,
} from "../constants/activityCategories";
import { logger } from "../utils/logger";
import { prisma } from "../utils/prisma";

const activityKindSchema = z.object({
  kind: z.enum(ACTIVITY_KINDS),
});

export type ActivityKindInput = {
  title: string;
  measure: string;
  emoji?: string | null;
};

const HEURISTIC_PATTERNS: [RegExp, ActivityKind][] = [
  [/\b(run|running|jog|jogging|5k|10k|marathon|hyrox)\b/, "running"],
  [/\b(walk|walking)\b/, "walking"],
  [/\b(cycl|bike|biking|riding)\b/, "cycling"],
  [/\b(hike|hiking)\b/, "hiking"],
  [/\b(swim|swimming)\b/, "swimming"],
  [/\b(surf|surfing)\b/, "surfing"],
  [/\b(skate|skating)\b/, "skating"],
  [/\b(kayak|rowing|paddle)\b/, "kayaking"],
  [/\b(gym|strength|crossfit|crosstraining|hiit|weight|workout)\b/, "gym"],
  [/\b(box|boxing)\b/, "boxing"],
  [/\b(boulder|bouldering|climb)\b/, "bouldering"],
  [/\b(yoga|pilates)\b/, "yoga"],
  [/\b(meditat)\b/, "meditation"],
  [/\b(read|reading)\b/, "reading"],
];

function heuristicKind(input: ActivityKindInput): ActivityKind {
  const text =
    `${input.title} ${input.measure} ${input.emoji ?? ""}`.toLowerCase();
  for (const [pattern, kind] of HEURISTIC_PATTERNS) {
    if (pattern.test(text)) return kind;
  }
  return DEFAULT_ACTIVITY_KIND;
}

export async function classifyActivityKind(
  input: ActivityKindInput
): Promise<ActivityKind> {
  const fallback = heuristicKind(input);

  if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL) {
    return fallback;
  }

  try {
    const result = await generateText({
      model: gateway(
        process.env.ACTIVITY_CATEGORY_MODEL || "openai/gpt-5.4-mini"
      ),
      output: Output.object({
        schema: activityKindSchema,
        name: "activityKind",
        description: "The canonical kind for a user-defined activity.",
      }),
      prompt: dedent`
        Classify this user-defined activity into exactly one kind.

        Kinds: ${ACTIVITY_KINDS.join(", ")}

        Guidelines:
        - running: running, jogging, treadmill, races, hyrox
        - walking: walking, strolling
        - cycling: cycling, biking, spinning
        - hiking: hiking, trekking
        - swimming: swimming, laps
        - surfing: surfing, bodyboarding
        - skating: skating, rollerblading, skateboarding
        - kayaking: kayaking, rowing, canoeing, paddleboarding
        - gym: gym, strength training, crossfit, HIIT, home workouts, calisthenics
        - boxing: boxing, kickboxing, martial arts
        - bouldering: bouldering, rock climbing
        - yoga: yoga, pilates, stretching
        - meditation: meditation, mindfulness, breathwork
        - reading: reading books, articles
        - other: anything that doesn't clearly fit the above

        Activity:
        - title: ${input.title}
        - measure: ${input.measure}
        - emoji: ${input.emoji ?? ""}

        Return only the structured kind.
      `,
    });

    return result.output.kind;
  } catch (error) {
    logger.warn("Activity kind classification failed, using fallback", {
      error,
      title: input.title,
      measure: input.measure,
    });
    return fallback;
  }
}

export async function classifyAndUpdateActivityKind(activity: {
  id: string;
  title: string;
  measure: string;
  emoji?: string | null;
}): Promise<ActivityKind> {
  const kind = await classifyActivityKind(activity);

  await prisma.activity.update({
    where: { id: activity.id },
    data: { kind },
  });

  return kind;
}
