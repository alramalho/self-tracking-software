import { aiService } from "../../../aiService";
import {
  onboardingModel,
  onboardingProvider,
  onboardingProviderOptions,
} from "../../../aiModelIds";
import { FollowThroughInputError } from "../../errors";
import { resultSchema, interviewRequestSchema } from "./schema";
import type {
  InterviewResult,
  InterviewState,
} from "@tsw/prisma/follow-through";
import type { z } from "zod/v4";
import type { InterviewContext } from "./types";
import { independentTrackingStep } from "../next-step";
import { interviewPrompt } from "./prompts";
import { goalLooksRealistic } from "./guidance";

const coachingQuestion = {
  title: "Would you like coaching for this plan?",
  purpose:
    "A coach can help shape sessions and suggest adjustments. Or you can track your own plan for free.",
  options: ["Yes, coach this plan", "No, just track it"],
};

function supportSelection(answer: string): boolean | undefined {
  const choice = answer
    .trim()
    .toLowerCase()
    .replace(/[\u2013\u2014]/g, "-");
  if (choice === "yes, coach this plan" || choice === "help me shape a plan")
    return true;
  if (
    choice === "no, just track it" ||
    choice === "i know my plan - just tracking"
  )
    return false;
  return undefined;
}

export function enforceInterviewResult(
  state: InterviewState,
  result: InterviewResult,
  answer?: string,
): InterviewResult {
  const f = result.facts;
  const failed = result.checks.filter((check) => !check.passed);
  const blocking = failed.filter((check) => check.required !== false);
  const optional = failed.filter((check) => check.required === false);
  result.needsImprovement = optional.length > 0;
  if (!blocking.length && optional.length) result.accepted = true;
  if (blocking.length && result.accepted) {
    // A failed check overrides the model's own acceptance. That reply was written as an
    // acceptance, so its summary announces what was understood ("thanks for clarifying") and
    // its question belongs to the next stage. Leaving them beside the "needs one more detail"
    // status and the "Improve my answer" action shows a satisfied message with no hint of what
    // is actually missing, so the failed check supplies both the message and the follow-up.
    result.accepted = false;
    const missing =
      blocking
        .map((check) => check.detail.trim() || check.label.trim())
        .filter(Boolean)
        .join(" ") ||
      "I need one more concrete detail before this fits your plan.";
    result.summary = missing.slice(0, 600);
    const clarification = {
      title: missing.slice(0, 180),
      purpose:
        "This is the one detail I still need before your plan fits what is true for you.",
      options: [],
    };
    result.question = clarification;
    result.nextQuestion = clarification;
  }
  if (
    f.resourceUrl &&
    (!/^https:\/\//i.test(f.resourceUrl) || !URL.canParse(f.resourceUrl))
  )
    throw new FollowThroughInputError(
      "The suggested resource link was invalid. Please try again.",
    );
  if (
    f.commitment !== "WEEKLY" &&
    (!f.weekdays.length || f.weekdays.length > f.frequency)
  )
    throw new FollowThroughInputError(
      "The proposed days do not match the weekly target. Please clarify your weekly schedule.",
    );
  if (f.commitment === "TIMED" && !f.time)
    throw new FollowThroughInputError(
      "Please include a start time for the proposed timed sessions.",
    );
  if (result.accepted && !f.goal.trim())
    throw new FollowThroughInputError(
      "The answer could not be fully understood. Please add a little more detail and retry.",
    );
  if (
    result.accepted &&
    (state.stage === "support" || state.stage === "review") &&
    (!f.activityTitle.trim() || !f.measure.trim() || !f.nextStep.trim())
  )
    throw new FollowThroughInputError(
      "The proposed activity is incomplete. Please try again.",
    );
  if (result.accepted && state.stage === "rhythm")
    result.nextQuestion = coachingQuestion;
  if (result.accepted && state.stage === "support" && answer !== undefined) {
    const choice = supportSelection(answer);
    if (choice !== undefined) result.facts.wantsCoaching = choice;
  }
  if (
    result.accepted &&
    (state.stage === "support" || state.stage === "review") &&
    !f.wantsCoaching
  )
    f.nextStep = independentTrackingStep(f.activityTitle, f.nextStep);
  return result;
}
/** Ask once to move the date or shrink the target. If they insist, the coach takes it from there. */
function pushBackOnDeadline(result: InterviewResult): InterviewResult {
  const question = {
    title: `Reaching this by ${result.facts.targetDate} looks unrealistic from where you are now. Move the date, or aim for a smaller first target?`,
    purpose:
      "A target you can actually reach keeps the plan honest and the sessions safe.",
    options: ["Move the date later", "Set a smaller first target", "Keep it as it is"],
  };
  return {
    ...result,
    accepted: false,
    summary: question.title,
    question,
    nextQuestion: question,
  };
}

export async function interview(
  input: z.infer<typeof interviewRequestSchema>,
  context: InterviewContext = { existingActivities: [] },
) {
  const today = new Date().toISOString().slice(0, 10);
  const result = await aiService.generateStructuredResponse({
    schema: resultSchema,
    options: {
      model: onboardingModel(),
      temperature: 0.2,
      providerOptions: onboardingProviderOptions(),
      provider: onboardingProvider(),
    },
    systemPrompt: interviewPrompt(input.state.stage),
    prompt: JSON.stringify({
      ...input,
      appContext: context,
      today,
    }),
  });
  const checked = enforceInterviewResult(
    input.state,
    resultSchema.parse(result),
    input.answer,
  );
  const { facts } = checked;
  const alreadyPushedBack = input.state.turns.some(
    (turn) => turn.stage === "rhythm" && !turn.accepted,
  );
  if (
    input.state.stage === "rhythm" &&
    checked.accepted &&
    facts.targetDate &&
    !alreadyPushedBack &&
    !(await goalLooksRealistic({
      goal: facts.goal,
      baseline: facts.baseline,
      frequency: facts.frequency,
      targetDate: facts.targetDate,
      today,
    }))
  )
    return pushBackOnDeadline(checked);
  return checked;
}
