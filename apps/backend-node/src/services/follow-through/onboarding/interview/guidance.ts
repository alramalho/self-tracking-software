import { aiService } from "../../../aiService";
import {
  onboardingProvider,
  onboardingValidationModel,
  onboardingValidationProviderOptions,
} from "../../../aiModelIds";
import type { GoalGuidanceResult } from "@tsw/prisma/follow-through";
import { z } from "zod/v4";

const guidanceSchema = z.object({
  requirements: z
    .array(
      z.object({
        key: z.string().min(1).max(32),
        label: z.string().min(1).max(48),
        phrase: z.string().min(1).max(80),
        required: z.boolean(),
        passed: z.boolean(),
        detail: z.string().max(160),
      }),
    )
    .min(2)
    .max(4),
});

export const goalGuidancePrompt =
  "You are a fast first-pass goal validator for tracking.so. The user is still composing the answer on the first onboarding screen. Return 2–4 tiny guidance cards that tell them what useful information to include.\n\n" +
  "The first card must always be a concrete, actionable goal and must be required. Mark motivation or personal meaning as helpful, not required: a user can continue without explaining why. A current starting point is important when it materially affects a safe or realistic plan, but do not ask for session durations, dated sessions, or a full training plan here. The next onboarding screen can ask for deeper baseline details. Do not reject sincere, informal, short, or beginner answers. Only mark a requirement passed when the answer actually contains it. Keep each card label and phrase short enough for one compact card; phrase should be one short sentence fragment. Detail should be a kind, concrete hint, not a paragraph.";

export const goalGuidanceRequestSchema = z.object({
  answer: z.string().trim().min(1).max(1500),
  activityTitle: z.string().max(100).optional(),
});

export async function goalGuidance(
  input: z.infer<typeof goalGuidanceRequestSchema>,
): Promise<GoalGuidanceResult> {
  const result = await aiService.generateStructuredResponse({
    schema: guidanceSchema,
    options: {
      model: onboardingValidationModel(),
      temperature: 0.1,
      providerOptions: onboardingValidationProviderOptions(),
      provider: onboardingProvider(),
    },
    systemPrompt: goalGuidancePrompt,
    prompt: JSON.stringify({
      answer: input.answer,
      activityTitle: input.activityTitle || null,
    }),
  });
  return guidanceSchema.parse(result);
}
