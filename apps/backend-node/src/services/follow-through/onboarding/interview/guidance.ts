import { experimental_evaluate as evaluate } from "ai";
import type { GoalGuidanceResult } from "@tsw/prisma/follow-through";
import { z } from "zod/v4";

export const goalGuidanceRequestSchema = z.object({
  answer: z.string().trim().min(1).max(1500),
  activityTitle: z.string().max(100).optional(),
});

const JEV_MODEL = "typesafe-ai/jev";
const PASS_THRESHOLD = 0.65;

function passed(probability: number) {
  return probability >= PASS_THRESHOLD;
}

export async function goalGuidance(
  input: z.infer<typeof goalGuidanceRequestSchema>,
): Promise<GoalGuidanceResult> {
  const result = await evaluate({
    model: JEV_MODEL,
    state: JSON.stringify({
      answer: input.answer,
      activityTitle: input.activityTitle || null,
    }),
    questions: {
      goal: {
        type: "boolean",
        instructions:
          "Does the answer state a concrete, actionable outcome the user wants to achieve? Accept sincere beginner or informal goals; reject empty, keyboard-noise, purely emotional, or non-actionable answers.",
      },
      baseline: {
        type: "boolean",
        instructions:
          "Does the answer include any useful current starting point, such as current ability, experience, routine, or constraints? This is helpful context, not a requirement for continuing this screen.",
      },
      motivation: {
        type: "boolean",
        instructions:
          "Does the answer explain why this goal matters personally, such as a reason, value, event, enjoyment, or motivation? This is optional context, not a requirement.",
      },
    },
    maxRetries: 1,
  });

  const goalPassed = passed(result.answers.goal.probability);
  const baselinePassed = passed(result.answers.baseline.probability);
  const motivationPassed = passed(result.answers.motivation.probability);

  return {
    requirements: [
      {
        key: "goal",
        label: "A clear target",
        phrase: "Say what you want to achieve.",
        required: true,
        passed: goalPassed,
        detail: goalPassed
          ? "Your goal is clear."
          : "Add the outcome you want to achieve.",
      },
      {
        key: "baseline",
        label: "Where you are now",
        phrase: "Mention your current starting point.",
        required: false,
        passed: baselinePassed,
        detail: baselinePassed
          ? "Useful starting-point context included."
          : "Helpful context for the next step.",
      },
      {
        key: "motivation",
        label: "Why it matters",
        phrase: "Share what makes this worth doing.",
        required: false,
        passed: motivationPassed,
        detail: motivationPassed
          ? "Personal meaning included."
          : "Optional context for a more personal plan.",
      },
    ],
  };
}
