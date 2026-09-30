import { describe, expect, it } from "vitest";
import { routeDays } from "./frequency";
import { classifyGoal, designOptions, extendWindow, nextSubgoalQuestion } from "./service";
import { validateSessions } from "./validate";
import type { ObjectGenerator } from "./types";
import type { DesignInput, WindowInput } from "./types";

const usage = { model: "fake", inputTokens: 1, outputTokens: 1, reasoningTokens: 0 };
const fake = (...outputs: unknown[]) => {
  const calls: { prompt: string }[] = [];
  const generate: ObjectGenerator = async ({ schema, prompt }) => {
    calls.push({ prompt });
    const next = outputs[Math.min(calls.length - 1, outputs.length - 1)];
    return { object: schema.parse(next), usage };
  };
  return { generate, calls };
};

const START = "2026-10-05";
const targets = (over: object = {}) => ({
  durationMinutes: 30,
  effort: "easy, can talk",
  pace: { minSecondsPerKm: 420, maxSecondsPerKm: 444, basis: "USER_REPORTED_EASY_PACE", evidence: "Easy 5 km in 35–37 min" },
  exercise: null,
  sets: null,
  reps: null,
  loadKg: null,
  restSeconds: null,
  progressMeasure: "Finish able to talk in sentences",
  ...over,
});
const session = (date: string, over: object = {}) => ({
  date,
  activity: "running",
  quantity: 4,
  title: "Easy run",
  descriptiveGuide: "Walk 5 minutes, then run easy and finish with a walk.",
  targets: targets(),
  ...over,
});
const offsets = (days: number[]) => days.map((d) => new Date(Date.parse(`${START}T12:00:00Z`) + d * 86400000).toISOString().slice(0, 10));
const route = (id: "steady" | "focused", weeks: number, dayOffsets: number[], over: object = {}) => ({
  id,
  estimatedWeeks: weeks,
  rationale: "Builds from two runs a week.",
  assumptions: ["You stay injury free"],
  phases: [
    { title: "Base", startWeek: 1, endWeek: 4, progressCheck: "Run 5 km easy twice without stopping" },
    { title: "Build", startWeek: 5, endWeek: weeks, progressCheck: "Long run reaches 15 km" },
  ],
  sessions: offsets(dayOffsets).map((d) => session(d, over)),
  ...over,
});
const readyOutput = (steady = [0, 2, 5, 7, 9, 12], focused = [0, 1, 3, 5, 7, 8, 10, 12]) => ({
  status: "READY",
  question: null,
  baselineMeasurements: [
    { metric: "easy_pace_fast", value: 420, unit: "s/km", sourceQuote: "Easy 5 km in 35–37 min" },
    { metric: "easy_pace_slow", value: 444, unit: "s/km", sourceQuote: "Easy 5 km in 35–37 min" },
  ],
  options: [
    { ...route("steady", 20, steady), sessions: offsets(steady).map((d) => session(d)) },
    { ...route("focused", 16, focused), sessions: offsets(focused).map((d) => session(d)) },
  ],
});
const input: DesignInput = {
  goal: "Finish my first half marathon",
  goalSpec: { metric: null, value: null, unit: null, text: null, chosenByUser: false },
  baseline: "Run twice a week, 5 km each. Easy 5 km in 35–37 min.",
  activities: [{ key: "running", title: "Running", measure: "km", emoji: "🏃" }],
  availableDays: 4,
  fixedDate: null,
  asked: [],
  startDate: START,
};

describe("how many days", () => {
  it("is a limit: Oli uses every day, Helly keeps room", () => {
    expect(routeDays(2)).toEqual({ steady: 2, focused: 2 });
    expect(routeDays(3)).toEqual({ steady: 3, focused: 3 });
    expect(routeDays(5)).toEqual({ steady: 4, focused: 5 });
    expect(routeDays(7)).toEqual({ steady: 5, focused: 7 });
  });
});

describe("designOptions", () => {
  it("returns two routes with the days fixed by code, finish dates derived from weeks", async () => {
    const { generate } = fake(readyOutput());
    const result = await designOptions(input, generate);
    expect(result.status).toBe("READY");
    expect(result.options.map((o) => [o.coach, o.trainingDaysPerWeek])).toEqual([["Helly", 3], ["Oli", 4]]);
    expect(result.options[0].finishingDate).toBe("2027-02-21");
    expect(result.options[0].sessions[0].targets.pace?.basis).toBe("USER_REPORTED_EASY_PACE");
    expect(result.baseline.measurements).toHaveLength(2);
  });

  it("retries once with the exact problems, then succeeds", async () => {
    const bad = readyOutput([0, 2, 5, 7, 9]); // steady week 2 has two days
    const { generate, calls } = fake(bad, readyOutput());
    const result = await designOptions(input, generate);
    expect(result.options).toHaveLength(2);
    expect(calls).toHaveLength(2);
    expect(calls[1].prompt).toContain("steady: week 2 has 2 training days, expected 3");
  });

  it("fails loudly instead of showing an unreliable plan", async () => {
    const { generate } = fake(readyOutput([0, 2]));
    await expect(designOptions(input, generate)).rejects.toThrow(/reliable plan/);
  });

  it("passes a fixed date through as the finish of both routes", async () => {
    const { generate } = fake(readyOutput());
    const result = await designOptions({ ...input, fixedDate: "2027-03-14" }, generate);
    expect(result.options.map((o) => o.finishingDate)).toEqual(["2027-03-14", "2027-03-14"]);
  });

  it("asks one question instead of inventing when blocked", async () => {
    const { generate } = fake({ status: "ASK", question: "Is your race on a fixed date?", baselineMeasurements: [], options: [] });
    const result = await designOptions(input, generate);
    expect(result).toMatchObject({ status: "ASK", question: "Is your race on a fixed date?", options: [] });
  });
});

describe("pace is grounded", () => {
  const ctx = (easyPace: { fast: number; slow: number } | null) => ({
    activities: [{ key: "running", measure: "km" }],
    windowStart: START,
    trainingDaysPerWeek: 1,
    easyPace,
    weeks: 1,
  });
  const one = (t: object) => [session(offsets([0])[0], { targets: targets(t) })];
  it("rejects a reported pace when the baseline had none", () => {
    expect(validateSessions(one({}), ctx(null)).join()).toContain("baseline has no pace");
  });
  it("accepts UNKNOWN with null numbers", () => {
    const unknown = { pace: { minSecondsPerKm: null, maxSecondsPerKm: null, basis: "UNKNOWN", evidence: null } };
    expect(validateSessions(one(unknown), ctx(null))).toEqual([]);
  });
  it("rejects numbers with basis UNKNOWN and paces outside the reported range", () => {
    const invented = { pace: { minSecondsPerKm: 300, maxSecondsPerKm: 330, basis: "UNKNOWN", evidence: null } };
    expect(validateSessions(one(invented), ctx(null)).join()).toContain("basis UNKNOWN");
    const fast = { pace: { minSecondsPerKm: 300, maxSecondsPerKm: 330, basis: "USER_REPORTED_EASY_PACE", evidence: "x" } };
    expect(validateSessions(one(fast), ctx({ fast: 420, slow: 444 })).join()).toContain("drifts outside");
  });
  it("requires distance to fit the time", () => {
    const long = [session(offsets([0])[0], { quantity: 10, targets: targets({ durationMinutes: 30 }) })];
    expect(validateSessions(long, ctx({ fast: 420, slow: 444 })).join()).toContain("does not fit");
  });
});

describe("classify and sub-goal question", () => {
  const classified = (over: object = {}) => ({
    orientation: "OUTCOME",
    reason: "A finishable race.",
    activity: { title: "Running", measure: "km", emoji: "🏃" },
    goalSpec: { metric: "FINISH_TIME", value: 7200, unit: "s", text: "under 2 hours", chosenByUser: false },
    baselineQuestion: "How much do you run now?",
    ...over,
  });
  it("never keeps a target the person did not write", async () => {
    const result = await classifyGoal({ goal: "Finish my first half marathon", existingActivities: [] }, fake(classified()).generate);
    expect(result.goalSpec).toEqual({ metric: null, value: null, unit: null, text: null, chosenByUser: false });
  });
  it("keeps a target the person wrote", async () => {
    const stated = classified({ goalSpec: { metric: "FINISH_TIME", value: 7200, unit: "s", text: "under 2 hours", chosenByUser: true } });
    const result = await classifyGoal({ goal: "Half marathon under 2 hours", existingActivities: [] }, fake(stated).generate);
    expect(result.goalSpec.text).toBe("under 2 hours");
  });

  const base = {
    goal: "Finish my first half marathon",
    orientation: "OUTCOME" as const,
    goalSpec: { metric: null, value: null, unit: null, text: null, chosenByUser: false },
    activity: { title: "Running", measure: "km" },
    baseline: "Two 5 km runs a week",
    asked: [],
  };
  const ask = { ask: true, kind: "FINISH_TIME", title: "Do you have a finish time in mind?", choices: ["Under 2 hours", "Under 2:30"] };
  it("always leaves a way to decline", async () => {
    const { question } = await nextSubgoalQuestion(base, fake(ask).generate);
    expect(question?.choices.at(-1)).toBe("No target in mind");
  });
  it("does not ask for consistency, after a decline, or a third time", async () => {
    const never = fake(ask);
    expect((await nextSubgoalQuestion({ ...base, orientation: "CONSISTENCY" }, never.generate)).question).toBeNull();
    expect((await nextSubgoalQuestion({ ...base, asked: [{ question: "Finish time?", answer: "Just finish" }] }, never.generate)).question).toBeNull();
    expect((await nextSubgoalQuestion({ ...base, asked: [{ question: "a", answer: "b" }, { question: "c", answer: "d" }] }, never.generate)).question).toBeNull();
    expect(never.calls).toHaveLength(0);
  });
  it("never repeats a question it already asked", async () => {
    const repeated = await nextSubgoalQuestion({ ...base, asked: [{ question: "Do you have a finish time in mind?", answer: "Hmm" }] }, fake(ask).generate);
    expect(repeated.question).toBeNull();
  });
});

describe("extendWindow (rolling regeneration)", () => {
  const plan: WindowInput = {
    goal: "Finish my first half marathon",
    goalSpec: null,
    baseline: { text: "Easy 5 km in 35–37 min", measurements: [{ metric: "easy_pace_fast", value: 420, unit: "s/km", sourceQuote: "q" }, { metric: "easy_pace_slow", value: 444, unit: "s/km", sourceQuote: "q" }] },
    outline: { route: "steady", coach: "Helly", phases: [], assumptions: [], trainingDaysPerWeek: 3, startDate: START, estimatedWeeks: 20 },
    finishingDate: "2027-02-21",
    activities: [{ id: "act1", key: "running", title: "Running", measure: "km", emoji: "🏃" }],
    sessions: [
      { id: "s1", date: "2026-10-05", activityId: "act1", quantity: 4, title: "Easy run", targets: null, completed: true },
      { id: "s2", date: "2026-10-16", activityId: "act1", quantity: 5, title: "Long run", targets: null, completed: false },
      { id: "s3", date: "2026-10-18", activityId: "act1", quantity: 4, title: "Easy run", targets: null, completed: false },
    ],
    results: [{ date: "2026-10-05", activityId: "act1", quantity: 4, difficulty: "hard", note: "legs heavy" }],
    approvedHealthContext: null,
    today: "2026-10-15",
    feedback: null,
  };
  const windowOutput = (from: string) => ({
    summary: "Held the distance after a hard week. Adding one easy km next week.",
    phases: route("steady", 20, [0]).phases,
    sessions: [0, 2, 5, 7, 9, 12].map((d) =>
      session(new Date(Date.parse(`${from}T12:00:00Z`) + d * 86400000).toISOString().slice(0, 10), { activity: "act1" }),
    ),
  });
  it("appends after the last designed day and keeps everything existing", async () => {
    const { generate, calls } = fake(windowOutput("2026-10-19"));
    const result = await extendWindow({ ...plan, replaceUpcoming: false }, generate);
    expect(result.replaceSessionIds).toEqual([]);
    expect(result.designedThrough).toBe("2026-11-01");
    expect(result.sessions.every((s) => s.activityId === "act1" && s.date >= "2026-10-19")).toBe(true);
    expect(calls[0].prompt).toContain("legs heavy");
  });
  it("after a hard week replaces only upcoming uncompleted sessions, starting today", async () => {
    const { generate } = fake(windowOutput("2026-10-15"));
    const result = await extendWindow({ ...plan, replaceUpcoming: true, feedback: "Too hard" }, generate);
    expect(result.replaceSessionIds).toEqual(["s2", "s3"]);
    expect(result.designedThrough).toBe("2026-10-28");
  });
});
