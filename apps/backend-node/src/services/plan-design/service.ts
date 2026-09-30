import type {
  ClassifyResult,
  DesignActivity,
  DesignOption,
  DesignSession,
  SubgoalQuestion,
} from "@tsw/prisma/follow-through";
import { FollowThroughInputError } from "../follow-through/errors";
import { addDays, daysBetween, finishingDateFor } from "./dates";
import { gatewayGenerator } from "./generator";
import { routeCoach, routeDays } from "./frequency";
import { classifyPrompt, designPrompt, subgoalPrompt, windowPrompt } from "./prompts";
import { classifySchema, designSchema, subgoalSchema, windowSchema, type DesignOutput } from "./schema";
import type {
  ClassifyInput,
  DesignInput,
  DesignResult,
  GenerationUsage,
  ObjectGenerator,
  SubgoalInput,
  WindowInput,
  WindowResult,
} from "./types";
import { easyPaceFrom, validateSessions } from "./validate";

const DECLINE = /^(just|no |none|skip|not sure|i.?ll|nothing)/i;

export const activityKey = (title: string) =>
  title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "activity";

/** Step 1, right after the goal: outcome or consistency, the activity, and any target already stated. */
export async function classifyGoal(
  input: ClassifyInput,
  generate: ObjectGenerator = gatewayGenerator,
): Promise<ClassifyResult & { usage: GenerationUsage }> {
  const { object, usage } = await generate({
    name: "classifyGoal",
    schema: classifySchema,
    system: classifyPrompt,
    prompt: JSON.stringify(input),
    effort: "low",
  });
  // A number is only a target if the person wrote it.
  const goalSpec = object.goalSpec.chosenByUser
    ? object.goalSpec
    : { metric: null, value: null, unit: null, text: null, chosenByUser: false };
  return { ...object, goalSpec, usage };
}

/** Step 3: at most one more question, only when something the person would choose is missing. */
export async function nextSubgoalQuestion(
  input: SubgoalInput,
  generate: ObjectGenerator = gatewayGenerator,
): Promise<{ question: SubgoalQuestion | null; usage: GenerationUsage | null }> {
  // Consistency has no endpoint to specify. Two questions is the ceiling; a stated target or a decline ends it.
  if (
    input.orientation === "CONSISTENCY" ||
    input.goalSpec.chosenByUser ||
    input.asked.length >= 2 ||
    input.asked.some((a) => DECLINE.test(a.answer.trim()))
  )
    return { question: null, usage: null };
  const { object, usage } = await generate({
    name: "subgoalQuestion",
    schema: subgoalSchema,
    system: subgoalPrompt,
    prompt: JSON.stringify(input),
    effort: "low",
  });
  if (!object.ask || !object.title || object.choices.length < 2) return { question: null, usage };
  const repeated = input.asked.some(
    (a) => a.question.trim().toLowerCase() === object.title!.trim().toLowerCase(),
  );
  if (repeated) return { question: null, usage };
  const choices = DECLINE.test(object.choices.at(-1)!)
    ? object.choices
    : [...object.choices.slice(0, 3), "No target in mind"];
  return { question: { kind: object.kind ?? "OTHER", title: object.title, choices }, usage };
}

function designPromptInput(input: DesignInput, trainingDays: Record<"steady" | "focused", number>) {
  return JSON.stringify({
    goal: input.goal,
    goalSpec: input.goalSpec,
    baselineVerbatim: input.baseline,
    answers: input.asked,
    activities: input.activities,
    trainingDays,
    startDate: input.startDate,
    fixedDate: input.fixedDate,
    window: { firstDay: input.startDate, lastDay: addDays(input.startDate, 13) },
  });
}

function toOptions(output: DesignOutput, input: DesignInput): DesignOption[] {
  const days = routeDays(input.availableDays);
  return (["steady", "focused"] as const).map((id) => {
    const option = output.options.find((o) => o.id === id);
    if (!option) throw new FollowThroughInputError("The plan came back incomplete. Please try again.");
    const weeks = input.fixedDate
      ? Math.max(2, Math.ceil((daysBetween(input.startDate, input.fixedDate) + 1) / 7))
      : option.estimatedWeeks;
    return {
      id,
      coach: routeCoach[id],
      trainingDaysPerWeek: days[id],
      estimatedWeeks: weeks,
      finishingDate: input.fixedDate ?? finishingDateFor(input.startDate, weeks),
      rationale: option.rationale,
      assumptions: option.assumptions,
      phases: option.phases,
      sessions: option.sessions as DesignSession[],
    };
  });
}

function problemsIn(output: DesignOutput, input: DesignInput) {
  const days = routeDays(input.availableDays);
  const easyPace = easyPaceFrom(output.baselineMeasurements);
  const problems: string[] = [];
  for (const id of ["steady", "focused"] as const) {
    const option = output.options.find((o) => o.id === id);
    if (!option) {
      problems.push(`route ${id} is missing`);
      continue;
    }
    for (const p of validateSessions(option.sessions, {
      activities: input.activities,
      windowStart: input.startDate,
      trainingDaysPerWeek: days[id],
      easyPace,
      weeks: 2,
    }))
      problems.push(`${id}: ${p}`);
  }
  if (
    output.options.length === 2 &&
    !input.fixedDate &&
    output.options[0].estimatedWeeks === output.options[1].estimatedWeeks
  )
    problems.push("the two routes must not have the same estimatedWeeks");
  return problems;
}

/**
 * Step 4: two honest routes (Helly steady, Oli focused) with the first two weeks each.
 * Validated in code; one retry with the exact problems, then a clear failure rather than a bad plan.
 */
export async function designOptions(
  input: DesignInput,
  generate: ObjectGenerator = gatewayGenerator,
): Promise<DesignResult> {
  const usage: GenerationUsage[] = [];
  const days = routeDays(input.availableDays);
  let prompt = designPromptInput(input, days);
  let output: DesignOutput | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await generate({
      name: "designRoutes",
      schema: designSchema,
      system: designPrompt,
      prompt,
      effort: "high",
    });
    usage.push(result.usage);
    output = result.object;
    const baseline = { text: input.baseline, measurements: output.baselineMeasurements };
    if (output.status === "ASK" && output.question)
      return { status: "ASK", question: output.question, baseline, options: [], usage };
    const problems = problemsIn(output, input);
    if (!problems.length)
      return { status: "READY", question: null, baseline, options: toOptions(output, input), usage };
    prompt = `${designPromptInput(input, days)}\nYour previous answer was rejected for: ${problems.slice(0, 8).join("; ")}. Return a corrected full answer.`;
  }
  throw new FollowThroughInputError("We couldn't build a reliable plan just now. Please try again.");
}

/**
 * Rolling regeneration. The plan keeps the road (outline) and the person's target; each review
 * designs the next 14 days from what actually happened. Completed and past sessions are never touched.
 * `replaceUpcoming` (used after a hard week) starts today and swaps the upcoming uncompleted sessions;
 * otherwise the window starts after the last designed day.
 */
export async function extendWindow(
  input: WindowInput & { replaceUpcoming: boolean },
  generate: ObjectGenerator = gatewayGenerator,
): Promise<WindowResult> {
  const lastDesigned = input.sessions.reduce((m, s) => (s.date > m ? s.date : m), input.today);
  const windowStart = input.replaceUpcoming ? input.today : addDays(lastDesigned, 1);
  const replaceSessionIds = input.replaceUpcoming
    ? input.sessions.filter((s) => !s.completed && s.date >= input.today).map((s) => s.id)
    : [];
  const measurements = input.baseline?.measurements ?? [];
  const prompt = JSON.stringify({
    goal: input.goal,
    goalSpec: input.goalSpec,
    baselineVerbatim: input.baseline?.text ?? null,
    baselineMeasurements: measurements,
    outline: input.outline,
    finishingDate: input.finishingDate,
    activities: input.activities.map((a) => ({ key: a.id, title: a.title, measure: a.measure })),
    trainingDays: input.outline.trainingDaysPerWeek,
    today: input.today,
    windowStart,
    windowEnd: addDays(windowStart, 13),
    existingSessions: input.sessions,
    results: input.results,
    approvedHealthContext: input.approvedHealthContext,
    feedback: input.feedback,
  });
  let retry = "";
  let usage: GenerationUsage | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await generate({
      name: "extendWindow",
      schema: windowSchema,
      system: windowPrompt,
      prompt: prompt + retry,
      effort: "high",
    });
    usage = result.usage;
    const problems = validateSessions(result.object.sessions, {
      activities: input.activities.map((a) => ({ key: a.id, measure: a.measure })),
      windowStart,
      trainingDaysPerWeek: input.outline.trainingDaysPerWeek,
      easyPace: easyPaceFrom(measurements),
      weeks: 2,
    });
    if (!problems.length)
      return {
        replaceSessionIds,
        sessions: result.object.sessions.map(({ activity, ...s }) => ({ ...s, activityId: activity })),
        phases: result.object.phases,
        summary: result.object.summary,
        designedThrough: addDays(windowStart, 13),
        usage,
      };
    retry = `\nYour previous answer was rejected for: ${problems.slice(0, 8).join("; ")}. Return a corrected full answer.`;
  }
  throw new Error("Window design failed validation twice");
}

export type { DesignActivity };
