import type {
  ClassifyResult,
  CoachNote,
  DesignActivity,
  DesignOption,
  DesignSession,
  SubgoalQuestion,
} from "@tsw/prisma/follow-through";
import { FollowThroughInputError } from "../follow-through/errors";
import { addDays, daysBetween, finishingDateFor } from "./dates";
import { gatewayGenerator } from "./generator";
import { designEffort } from "../aiModelIds";
import { defaultRanges, routeCoach, sameRanges, sanitizeRanges, type DayRange } from "./frequency";
import { assessPrompt, classifyPrompt, designPrompt, subgoalPrompt, windowPrompt } from "./prompts";
import { assessSchema, classifySchema, routeSchema, subgoalSchema, windowSchema, type RouteOutput } from "./schema";
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

type RouteId = "steady" | "focused";

function routePrompt(input: DesignInput, id: RouteId, range: DayRange, extra = "") {
  return JSON.stringify({
    route: id,
    goal: input.goal,
    goalSpec: input.goalSpec,
    baselineVerbatim: input.baseline,
    answers: input.asked,
    activities: input.activities,
    daysRange: { min: range.min, max: range.max },
    startDate: input.startDate,
    fixedDate: input.fixedDate,
    window: { firstDay: input.startDate, lastDay: addDays(input.startDate, 13) },
  }) + extra;
}

function problemsIn(output: RouteOutput, input: DesignInput, id: RouteId, range: DayRange) {
  const route = output.route;
  if (!route) return [`route ${id} is missing`];
  if (route.id !== id) return [`route id must be ${id}`];
  return validateSessions(route.sessions, {
    activities: input.activities,
    windowStart: input.startDate,
    daysMin: range.min,
    daysMax: range.max,
    easyPace: easyPaceFrom(output.baselineMeasurements),
    weeks: 2,
  });
}

async function designRoute(
  input: DesignInput,
  id: RouteId,
  range: DayRange,
  generate: ObjectGenerator,
  extra = "",
): Promise<{ output: RouteOutput; usage: GenerationUsage[]; retried: string[] }> {
  const usage: GenerationUsage[] = [];
  const retried: string[] = [];
  let retry = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await generate({
      name: `designRoute_${id}`,
      schema: routeSchema,
      system: designPrompt,
      prompt: routePrompt(input, id, range, extra) + retry,
      effort: designEffort(),
    });
    usage.push(result.usage);
    if (result.object.status === "ASK" && result.object.question) return { output: result.object, usage, retried };
    const problems = problemsIn(result.object, input, id, range);
    if (!problems.length) return { output: result.object, usage, retried };
    retried.push(...problems.slice(0, 4).map((p) => `${id}: ${p}`));
    retry = `\nYour previous answer was rejected for: ${problems.slice(0, 8).join("; ")}. Return a corrected full answer.`;
  }
  throw new FollowThroughInputError("We couldn't build a reliable plan just now. Please try again.");
}

function toOption(output: RouteOutput, input: DesignInput, id: RouteId, range: DayRange): DesignOption {
  const route = output.route!;
  const weeks = input.fixedDate
    ? Math.max(2, Math.ceil((daysBetween(input.startDate, input.fixedDate) + 1) / 7))
    : route.estimatedWeeks;
  return {
    id,
    coach: routeCoach[id],
    daysMin: range.min,
    daysMax: range.max,
    estimatedWeeks: weeks,
    finishingDate: input.fixedDate ?? finishingDateFor(input.startDate, weeks),
    rationale: route.rationale,
    assumptions: route.assumptions,
    phases: route.phases,
    sessions: route.sessions as DesignSession[],
  };
}

/**
 * Step 4a, the coach's reality check: do the preferred days fit the goal and the starting point?
 * FITS keeps the deterministic Garmin-style bracket (3 days: Helly 2–3, Oli 3–4). ADJUSTED lets the
 * coach move the ranges, within sanity limits, and say why. PUSHBACK stops: no plan is built that
 * pretends the goal fits. Without a usable explanation the coach is not allowed to block or adjust.
 */
export async function assessPreferredDays(
  input: DesignInput,
  generate: ObjectGenerator,
): Promise<{ note: CoachNote; ranges: Record<RouteId, DayRange>; usage: GenerationUsage }> {
  const base = defaultRanges(input.preferredDays);
  const { object, usage } = await generate({
    name: "assessDays",
    schema: assessSchema,
    system: assessPrompt,
    prompt: JSON.stringify({
      goal: input.goal,
      goalSpec: input.goalSpec,
      baselineVerbatim: input.baseline,
      answers: input.asked,
      preferredDays: input.preferredDays,
      fixedDate: input.fixedDate,
      startDate: input.startDate,
    }),
    effort: "low",
  });
  const fits = { verdict: "FITS" as const, message: null, suggestedDays: null, targetInvolved: false };
  if (object.verdict === "FITS" || !object.message?.trim()) return { note: fits, ranges: base, usage };
  if (object.verdict === "PUSHBACK") {
    // Never ask for the same days again: the suggestion must differ from the preference.
    const suggested = object.suggestedDays && object.suggestedDays !== input.preferredDays ? object.suggestedDays : null;
    return {
      note: { verdict: "PUSHBACK", message: object.message.trim(), suggestedDays: suggested, targetInvolved: object.targetInvolved },
      ranges: base,
      usage,
    };
  }
  const ranges = sanitizeRanges({
    steady: { min: object.steady.daysMin, max: object.steady.daysMax },
    focused: { min: object.focused.daysMin, max: object.focused.daysMax },
  });
  if (sameRanges(ranges, base)) return { note: fits, ranges: base, usage };
  return { note: { verdict: "ADJUSTED", message: object.message.trim(), suggestedDays: null, targetInvolved: false }, ranges, usage };
}

/**
 * Step 4: the coach's reality check, then two honest routes (Helly steady, Oli focused) with the
 * first two weeks each. Each route is its own call, run in parallel: the answers are shorter and the
 * wait is one call, not two. Validated in code; one retry per route with the exact problems, then a
 * clear failure rather than a bad plan. Oli must come out shorter than Helly (unless the finish date
 * is fixed); if not, Oli is asked again once.
 */
export async function designOptions(
  input: DesignInput,
  generate: ObjectGenerator = gatewayGenerator,
): Promise<DesignResult> {
  const assessed = await assessPreferredDays(input, generate);
  const usage: GenerationUsage[] = [assessed.usage];
  if (assessed.note.verdict === "PUSHBACK")
    return { status: "PUSHBACK", question: null, coachNote: assessed.note, retried: [], baseline: { text: input.baseline, measurements: [] }, options: [], usage };
  const { steady: steadyRange, focused: focusedRange } = assessed.ranges;
  const [steady, focusedFirst] = await Promise.all([
    designRoute(input, "steady", steadyRange, generate),
    designRoute(input, "focused", focusedRange, generate),
  ]);
  usage.push(...steady.usage, ...focusedFirst.usage);
  const retried = [...steady.retried, ...focusedFirst.retried];
  const asked = [steady.output, focusedFirst.output].find((o) => o.status === "ASK" && o.question);
  const baseline = { text: input.baseline, measurements: steady.output.baselineMeasurements };
  if (asked) return { status: "ASK", question: asked.question, coachNote: assessed.note, retried, baseline, options: [], usage };
  let focused = focusedFirst.output;
  const steadyWeeks = steady.output.route!.estimatedWeeks;
  if (!input.fixedDate && focused.route!.estimatedWeeks >= steadyWeeks) {
    const again = await designRoute(input, "focused", focusedRange, generate, `\nsteadyWeeks: ${steadyWeeks}. Your estimatedWeeks must be lower.`);
    usage.push(...again.usage);
    retried.push(...again.retried);
    focused = again.output;
    if (focused.route!.estimatedWeeks >= steadyWeeks)
      throw new FollowThroughInputError("We couldn't build two distinct plans just now. Please try again.");
  }
  return {
    status: "READY",
    question: null,
    coachNote: assessed.note,
    retried,
    baseline,
    options: [toOption(steady.output, input, "steady", steadyRange), toOption(focused, input, "focused", focusedRange)],
    usage,
  };
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
    daysRange: { min: input.outline.daysMin, max: input.outline.daysMax },
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
      effort: designEffort(),
    });
    usage = result.usage;
    const problems = validateSessions(result.object.sessions, {
      activities: input.activities.map((a) => ({ key: a.id, measure: a.measure })),
      windowStart,
      daysMin: input.outline.daysMin,
      daysMax: input.outline.daysMax,
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
