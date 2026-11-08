import { evaluate } from "../../../../utils/aiSdk";
import type { GoalGuidanceResult } from "@tsw/prisma/follow-through";
import { z } from "zod/v4";

export const goalGuidanceRequestSchema = z.object({
  step: z.enum(["goal", "baseline", "motivation"]).optional(),
  answer: z.string().trim().min(1).max(1500),
  goal: z.string().max(1500).optional(),
  activityTitle: z.string().max(100).optional(),
});

const JEV_MODEL = "typesafe-ai/jev";
const PASS_THRESHOLD = 0.65;

function passed(probability: number) {
  return probability >= PASS_THRESHOLD;
}

const checks = {
  goal: {
    label: "A clear target",
    phrase: "Say what you want to achieve.",
    required: true,
    instructions:
      "Does the answer state a concrete, actionable outcome the user wants to achieve? Accept sincere beginner or informal goals; reject empty, keyboard-noise, purely emotional, or non-actionable answers. Do not require the person to also state a baseline or motivation here.",
    passedDetail: "Your goal is clear.",
    failedDetail: "Add the outcome you want to achieve.",
  },
  baseline: {
    label: "Where you are now",
    phrase: "Mention your current starting point.",
    required: false,
    instructions:
      "Does the answer give a useful current starting point toward the stated goal, such as present ability, experience, routine, resources, or a relevant constraint? 'I'm starting from scratch' is valid. Do not demand numbers, a training history, or personal details. A future goal alone is not a starting point.",
    passedDetail: "Useful starting-point context included.",
    failedDetail: "Mention where you are now, or skip this step.",
  },
  motivation: {
    label: "Why it matters",
    phrase: "Share what makes this worth doing.",
    required: false,
    instructions:
      "Does the answer explain why the stated goal matters to this person, such as a personal reason, value, event, enjoyment, or motivation? Accept ordinary reasons without demanding sensitive disclosure. A description of the goal or current routine alone is not a reason.",
    passedDetail: "Personal meaning included.",
    failedDetail: "Share a reason, or skip this step.",
  },
} as const;

const allSteps = ["goal", "baseline", "motivation"] as const;

/**
 * When a goal fails, say what is missing instead of a generic "add the outcome".
 * Asked in the same call as the pass check, so it costs no extra round trip.
 */
const goalGap = {
  type: "choice",
  instructions:
    "If this answer is not yet a concrete, actionable goal, what is mainly missing? Pick 'clear' when it already names something the person can work towards.",
  criteria: {
    clear: "Already a concrete outcome the person can work towards.",
    feeling:
      "Describes a feeling or state of mind (calm, happy, confident, mindful) without anything to do or notice.",
    broad: "Names an area of life (health, fitness, money, career) but no specific result.",
    unclear: "Empty, filler, keyboard noise, or not a goal at all.",
  },
} as const;

const goalGapDetail: Record<keyof typeof goalGap.criteria, string> = {
  clear: checks.goal.failedDetail,
  feeling: "That's a feeling. Add what you'd do to get there, like “meditate 10 min a day”.",
  broad: "Too broad. Add a specific result, like “run 5 km” or “read 12 books this year”.",
  unclear: "Write the outcome you want, like “run 5 km” or “meditate daily”.",
};

export async function goalGuidance(
  input: z.infer<typeof goalGuidanceRequestSchema>,
): Promise<GoalGuidanceResult> {
  const result = await evaluate({
    model: JEV_MODEL,
    state: JSON.stringify({
      answer: input.answer,
      goal: input.goal || null,
      activityTitle: input.activityTitle || null,
    }),
    questions: {
      ...Object.fromEntries(
        (input.step ? [input.step] : allSteps).map((step) => [
          step,
          { type: "boolean", instructions: checks[step].instructions },
        ]),
      ),
      ...(!input.step || input.step === "goal" ? { goalGap } : {}),
    },
    maxRetries: 1,
  });

  return {
    requirements: (input.step ? [input.step] : allSteps).map((step) => {
      const check = checks[step];
      const answer = result.answers[step];
      const didPass = answer.type === "boolean" && passed(answer.probability);
      return {
        key: step,
        label: check.label,
        phrase: check.phrase,
        required: check.required,
        passed: didPass,
        detail: didPass ? check.passedDetail : failedDetail(step, result.answers.goalGap),
      };
    }),
  };
}

function failedDetail(step: keyof typeof checks, gap: { type: string; choice?: string } | undefined) {
  if (step !== "goal" || gap?.type !== "choice") return checks[step].failedDetail;
  return goalGapDetail[gap.choice as keyof typeof goalGapDetail] ?? checks.goal.failedDetail;
}

/**
 * Expectation alignment: is this target achievable by this date, from this starting point?
 * Only a clear "no" blocks, so ordinary ambitious goals pass untouched.
 */
export async function goalLooksRealistic(input: {
  goal: string;
  baseline: string;
  frequency: number;
  targetDate: string;
  today: string;
}): Promise<boolean> {
  // Do the date arithmetic here; the evaluator judges plausibility, not calendars.
  const weeksAvailable = Math.max(
    0,
    Math.round((Date.parse(input.targetDate) - Date.parse(input.today)) / (7 * 86400000)),
  );
  const result = await evaluate({
    model: JEV_MODEL,
    state: JSON.stringify({ ...input, weeksAvailable }),
    questions: {
      realistic: {
        type: "boolean",
        instructions:
          "Could a typical person with this starting point reach this goal by the target date, training this many times per week, safely? Answer no only for goals that are clearly unsafe or implausible in that time (for example a first marathon in three weeks from no running, or losing 20 kg in a month). If the starting point is unknown, assume an ordinary beginner.",
      },
    },
    maxRetries: 1,
  });
  const answer = result.answers.realistic;
  return answer.type !== "boolean" || answer.probability >= 0.3;
}
