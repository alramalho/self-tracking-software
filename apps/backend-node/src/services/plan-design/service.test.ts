import { describe, expect, it } from "vitest";
import { defaultRanges, sanitizeRanges } from "./frequency";
import { classifyGoal, designOptions, extendWindow, nextSubgoalQuestion } from "./service";
import { loadChangeProblems, validateSessions } from "./validate";
import type { ObjectGenerator } from "./types";
import type { DesignInput, WindowInput } from "./types";

const usage = { model: "fake", inputTokens: 1, outputTokens: 1, reasoningTokens: 0 };
const fake = (...outputs: unknown[]) => {
  const calls: { prompt: string; model: string }[] = [];
  const generate: ObjectGenerator = async ({ schema, prompt, model }) => {
    calls.push({ prompt, model });
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
const measurements = [
  { metric: "easy_pace_fast", value: 420, unit: "s/km", sourceQuote: "Easy 5 km in 35–37 min" },
  { metric: "easy_pace_slow", value: 444, unit: "s/km", sourceQuote: "Easy 5 km in 35–37 min" },
];
const routeOutput = (id: "steady" | "focused", weeks: number, dayOffsets: number[]) => ({
  status: "READY",
  question: null,
  baselineMeasurements: measurements,
  route: { ...route(id, weeks, dayOffsets), sessions: offsets(dayOffsets).map((d) => session(d)) },
});
const STEADY = [0, 2, 5, 7, 9, 12];
const FOCUSED = [0, 1, 3, 5, 7, 8, 10, 12];
const input: DesignInput = {
  goal: "Finish my first half marathon",
  goalSpec: { metric: null, value: null, unit: null, text: null, chosenByUser: false },
  baseline: "Run twice a week, 5 km each. Easy 5 km in 35–37 min.",
  activities: [{ key: "running", title: "Running", measure: "km", emoji: "🏃" }],
  preferredDays: 4,
  fixedDate: null,
  asked: [],
  startDate: START,
};

const fitsNote = { verdict: "FITS", message: null, steady: { daysMin: 3, daysMax: 4, weeks: 20 }, focused: { daysMin: 4, daysMax: 5, weeks: 16 }, suggestedDays: null, targetInvolved: false };

describe("days a person prefers", () => {
  it("are bracketed by the two coaches: Helly up to them, Oli at or above", () => {
    expect(defaultRanges(3)).toEqual({ steady: { min: 2, max: 3 }, focused: { min: 3, max: 4 } });
    expect(defaultRanges(1)).toEqual({ steady: { min: 1, max: 1 }, focused: { min: 1, max: 2 } });
    expect(defaultRanges(7)).toEqual({ steady: { min: 6, max: 7 }, focused: { min: 7, max: 7 } });
  });
  it("cannot be stretched by the coach past two days wide or below Helly", () => {
    expect(sanitizeRanges({ steady: { min: 2, max: 7 }, focused: { min: 1, max: 3 } })).toEqual({ steady: { min: 2, max: 4 }, focused: { min: 2, max: 4 } });
  });
});

describe("designOptions", () => {
  it("checks the days first, then builds each route in its own call", async () => {
    const { generate, calls } = fake(fitsNote, routeOutput("steady", 20, STEADY), routeOutput("focused", 16, FOCUSED));
    const result = await designOptions(input, generate);
    expect(calls).toHaveLength(3);
    expect(calls[1].prompt).toContain('"route":"steady"');
    expect(calls[1].prompt).toContain('"daysRange":{"min":3,"max":4}');
    expect(calls[2].prompt).toContain('"daysRange":{"min":4,"max":5}');
    expect(result.status).toBe("READY");
    expect(result.coachNote?.verdict).toBe("FITS");
    expect(result.options.map((o) => [o.coach, o.daysMin, o.daysMax])).toEqual([["Helly", 3, 4], ["Oli", 4, 5]]);
    expect(result.options[0].finishingDate).toBe("2027-02-21");
    expect(result.options[0].sessions[0].targets.pace?.basis).toBe("USER_REPORTED_EASY_PACE");
    expect(result.baseline.measurements).toHaveLength(2);
  });

  it("lets the coach adjust the days, and says why", async () => {
    const adjusted = { ...fitsNote, verdict: "ADJUSTED", message: "A first half marathon needs at least 3 runs a week, so both plans use 3–4.", steady: { daysMin: 3, daysMax: 3, weeks: 20 }, focused: { daysMin: 3, daysMax: 4, weeks: 16 } };
    const { generate, calls } = fake(adjusted, routeOutput("steady", 20, STEADY), routeOutput("focused", 16, [0, 2, 5, 7, 9, 12]));
    const result = await designOptions({ ...input, preferredDays: 1 }, generate);
    expect(result.coachNote).toMatchObject({ verdict: "ADJUSTED", message: expect.stringContaining("at least 3") });
    expect(calls[1].prompt).toContain('"daysRange":{"min":3,"max":3}');
    expect(result.options.map((o) => [o.daysMin, o.daysMax])).toEqual([[3, 3], [3, 4]]);
  });

  it("pushes back instead of building a plan that cannot work, and builds nothing", async () => {
    const pushback = { ...fitsNote, verdict: "PUSHBACK", message: "One run a week won't get a first-timer to a half marathon in under 1:30. Three days is the least that could work.", suggestedDays: 3, targetInvolved: true };
    const { generate, calls } = fake(pushback);
    const result = await designOptions({ ...input, preferredDays: 1, goalSpec: { metric: "FINISH_TIME", value: 5400, unit: "s", text: "under 1:30", chosenByUser: true } }, generate);
    expect(result).toMatchObject({ status: "PUSHBACK", options: [], coachNote: { verdict: "PUSHBACK", suggestedDays: 3, targetInvolved: true } });
    expect(calls).toHaveLength(1);
  });

  it("never offers the same days back, and never blocks or adjusts without an explanation", async () => {
    const same = { ...fitsNote, verdict: "PUSHBACK", message: "Not enough.", suggestedDays: 1 };
    const silent = { ...fitsNote, verdict: "PUSHBACK", message: null };
    const a = await designOptions({ ...input, preferredDays: 1 }, fake(same).generate);
    expect(a.coachNote?.suggestedDays).toBeNull();
    const { generate } = fake(silent, routeOutput("steady", 20, [0, 4, 7, 11]), routeOutput("focused", 16, [0, 4, 7, 11]));
    const b = await designOptions({ ...input, preferredDays: 2 }, generate);
    expect(b.status).toBe("READY");
    expect(b.coachNote?.verdict).toBe("FITS");
  });

  it("retries only the route that failed, with the exact problems", async () => {
    // steady's second week has two days, expected 3–4
    const { generate, calls } = fake(fitsNote, routeOutput("steady", 20, [0, 2, 5, 7, 9]), routeOutput("focused", 16, FOCUSED), routeOutput("steady", 20, STEADY));
    const result = await designOptions(input, generate);
    expect(result.options).toHaveLength(2);
    expect(calls).toHaveLength(4);
    expect(calls[3].prompt).toContain('"route":"steady"');
    expect(calls[3].prompt).toContain("week 2 has 2 training days, expected 3-4");
  });

  it("steps up to the fallback model before giving up", async () => {
    const bad = routeOutput("steady", 20, [0, 2]);
    const { generate, calls } = fake(fitsNote, bad, routeOutput("focused", 16, FOCUSED), bad, routeOutput("steady", 20, STEADY));
    // Opus designs by default; Sonnet is its fallback.
    const result = await designOptions(input, generate);
    expect(calls.map((c) => c.model)).toContain("anthropic/claude-opus-5.5");
    expect(calls.map((c) => c.model)).toContain("anthropic/claude-sonnet-5.5");
    expect(result.models).toContain("anthropic/claude-sonnet-5.5");
  });

  it("treats a reply that breaks the format as a failed attempt and retries", async () => {
    const { generate, calls } = fake(fitsNote, "not a route", routeOutput("focused", 16, FOCUSED), routeOutput("steady", 20, STEADY));
    const result = await designOptions(input, generate);
    expect(result.options).toHaveLength(2);
    expect(calls[3].prompt).toContain("could not be used");
  });

  it("fails loudly instead of showing an unreliable plan", async () => {
    const { generate } = fake(fitsNote, routeOutput("steady", 20, [0, 2]));
    await expect(designOptions(input, generate)).rejects.toThrow(/reliable plan/);
  });

  it("fixes the weeks of both roads up front, and Oli is always shorter", async () => {
    const longer = { ...fitsNote, steady: { ...fitsNote.steady, weeks: 16 }, focused: { ...fitsNote.focused, weeks: 18 } };
    const { generate, calls } = fake(longer, routeOutput("steady", 16, STEADY), routeOutput("focused", 12, FOCUSED));
    const result = await designOptions(input, generate);
    expect(calls).toHaveLength(3);
    expect(calls[1].prompt).toContain('"weeks":16');
    expect(calls[2].prompt).toContain('"weeks":12');
    expect(result.options.map((o) => o.estimatedWeeks)).toEqual([16, 12]);
  });

  it("rejects a route that ignores the weeks it was given", async () => {
    const { generate, calls } = fake(fitsNote, routeOutput("steady", 18, STEADY), routeOutput("focused", 16, FOCUSED), routeOutput("steady", 20, STEADY));
    await designOptions(input, generate);
    expect(calls[3].prompt).toContain("estimatedWeeks must be exactly 20");
  });

  it("passes a fixed date through as the finish of both routes", async () => {
    const { generate } = fake(fitsNote, routeOutput("steady", 23, STEADY), routeOutput("focused", 23, FOCUSED));
    const result = await designOptions({ ...input, fixedDate: "2027-03-14" }, generate);
    expect(result.options.map((o) => o.finishingDate)).toEqual(["2027-03-14", "2027-03-14"]);
  });

  it("a route may ask only about a fixed finish date; otherwise it must plan", async () => {
    const ask = { status: "ASK", question: "Can you lower the minimum days?", baselineMeasurements: [], route: null };
    const { generate, calls } = fake(fitsNote, ask, routeOutput("focused", 16, FOCUSED), routeOutput("steady", 20, STEADY));
    const result = await designOptions(input, generate);
    expect(result.status).toBe("READY");
    expect(calls[3].prompt).toContain("Do not ask");
  });

  it("asks one question about a fixed date it cannot meet", async () => {
    const ask = { status: "ASK", question: "Is your race on a fixed date?", baselineMeasurements: [], route: null };
    const { generate } = fake(fitsNote, ask, ask);
    const result = await designOptions({ ...input, fixedDate: "2026-10-26" }, generate);
    expect(result).toMatchObject({ status: "ASK", question: "Is your race on a fixed date?", options: [] });
  });
});

describe("pace is grounded", () => {
  const ctx = (easyPace: { fast: number; slow: number } | null) => ({
    activities: [{ key: "running", measure: "km" }],
    windowStart: START,
    daysMin: 1,
    daysMax: 1,
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

describe("builds from what the person already does", () => {
  const ctx = { activities: [{ key: "running", measure: "km" }], windowStart: START, daysMin: 4, daysMax: 4, easyPace: { fast: 420, slow: 444 }, weeks: 1 };
  const week = (km: number[]) => offsets([0, 2, 4, 6]).map((d, i) => session(d, { quantity: km[i] }));
  it("rejects a first week below the current weekly volume, accepts one at or above it", () => {
    expect(validateSessions(week([2, 2, 2, 2]), { ...ctx, baselineWeekly: 10 }).join()).toContain("less than the 10 the person already does");
    expect(validateSessions(week([2, 3, 2, 4]), { ...ctx, baselineWeekly: 10 })).toEqual([]);
  });
  it("rejects a first-week jump and a week of tiny sessions", () => {
    expect(validateSessions(week([5, 3, 5, 3]), { ...ctx, baselineWeekly: 10, baselineSession: 5 }).join()).toContain("a jump from the 10");
    expect(validateSessions(week([2, 2, 5, 5]), { ...ctx, baselineWeekly: 10, baselineSession: 5 }).join()).toContain("2 sessions under half");
    expect(validateSessions(week([2, 3, 4, 3]), { ...ctx, baselineWeekly: 10, baselineSession: 5 })).toEqual([]);
    // One 3 km run a week, coach asks for 3 days: three shorter runs are fine.
    const three = offsets([0, 2, 4]).map((d, i) => session(d, { quantity: [2, 2, 1][i] }));
    expect(validateSessions(three, { ...ctx, daysMin: 3, daysMax: 3, baselineWeekly: 3, baselineSession: 3 })).toEqual([]);
  });
  it("rejects a week whose heaviest set is below what they lift now; lighter volume days are fine", () => {
    const lift = (load: number) => session(offsets([0])[0], { activity: "bench", quantity: 15, targets: targets({ pace: null, sets: 3, reps: 5, loadKg: load }) });
    const c = { activities: [{ key: "bench", measure: "reps" }], windowStart: START, daysMin: 2, daysMax: 2, easyPace: null, weeks: 1, baselineLoadKg: 60 };
    const two = (a: number, b: number) => [lift(a), { ...lift(b), date: offsets([2])[0] }];
    expect(validateSessions(two(55, 55), c).join()).toContain("below the 60 kg");
    expect(validateSessions(two(60, 55), c)).toEqual([]);
  });
  it("asks Oli again when his first week asks for less than Helly's", async () => {
    const light = [0, 1, 3, 5, 7, 8, 10, 12];
    const lightFocused = { ...routeOutput("focused", 16, light), route: { ...routeOutput("focused", 16, light).route, sessions: offsets(light).map((d) => session(d, { quantity: 2 })) } };
    const { generate, calls } = fake(fitsNote, routeOutput("steady", 20, STEADY), lightFocused, routeOutput("focused", 16, FOCUSED));
    const result = await designOptions(input, generate);
    expect(calls).toHaveLength(4);
    expect(calls[3].prompt).toContain("must be at least 12");
    expect(result.retried.join()).toContain("less than steady's 12");
  });
});

describe("adaptation load rules", () => {
  const log = (date: string, quantity: number, difficulty: string | null = "normal") => ({ date, quantity, difficulty });
  const plan = (km: number[], start = "2026-10-12") =>
    [0, 2, 5, 7, 9, 12].map((d, i) => ({ date: new Date(Date.parse(`${start}T12:00:00Z`) + d * 86400000).toISOString().slice(0, 10), quantity: km[i] }));
  const week1 = [log("2026-10-05", 3), log("2026-10-07", 4), log("2026-10-10", 6)];
  it("after a hard session the next week stays at or under 90%", () => {
    const hard = [...week1.slice(0, 2), log("2026-10-10", 6, "hard")];
    expect(loadChangeProblems(hard, plan([4, 4, 5, 4, 5, 6]), "2026-10-12").join()).toContain("12 or less");
    expect(loadChangeProblems(hard, plan([3, 4, 5, 4, 4, 6]), "2026-10-12")).toEqual([]);
  });
  it("good weeks grow at most about 10%", () => {
    expect(loadChangeProblems(week1, plan([5, 5, 8, 5, 5, 9]), "2026-10-12").join()).toContain("15 or less");
    expect(loadChangeProblems(week1, plan([4, 4, 6, 4, 5, 6]), "2026-10-12")).toEqual([]);
  });
  it("after a missed week, restart at 75% and don't pass the pre-break week", () => {
    expect(loadChangeProblems(week1, plan([3, 4, 5, 4, 5, 6], "2026-10-19"), "2026-10-19").join()).toContain("10 or less");
    expect(loadChangeProblems(week1, plan([3, 3, 4, 4, 5, 5], "2026-10-19"), "2026-10-19").join()).toContain("past the 13");
    expect(loadChangeProblems(week1, plan([3, 3, 4, 4, 4, 5], "2026-10-19"), "2026-10-19")).toEqual([]);
  });
});

describe("stray characters", () => {
  it("rejects text in a writing system the person never used, but allows it when they did", () => {
    const sessions = [session(offsets([0])[0], { targets: targets({ effort: "easy, you should be.аб" }) })];
    const ctx = { activities: [{ key: "running", measure: "km" }], windowStart: START, daysMin: 1, daysMax: 1, easyPace: { fast: 420, slow: 444 }, weeks: 1 };
    expect(validateSessions(sessions, { ...ctx, personText: "I run twice a week" }).join()).toContain("Cyrillic");
    expect(validateSessions(sessions, { ...ctx, personText: "Я бегаю дважды в неделю" }).join()).not.toContain("Cyrillic");
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
    outline: { route: "steady", coach: "Helly", phases: [], assumptions: [], daysMin: 3, daysMax: 3, startDate: START, estimatedWeeks: 20 },
    finishingDate: "2027-02-21",
    activities: [{ id: "act1", key: "running", title: "Running", measure: "km", emoji: "🏃" }],
    sessions: [
      { id: "s1", date: "2026-10-05", activityId: "act1", quantity: 4, title: "Easy run", targets: null, completed: true },
      { id: "s2", date: "2026-10-16", activityId: "act1", quantity: 5, title: "Long run", targets: null, completed: false },
      { id: "s3", date: "2026-10-18", activityId: "act1", quantity: 4, title: "Easy run", targets: null, completed: false },
    ],
    results: [
      { date: "2026-10-05", activityId: "act1", quantity: 4, difficulty: "hard", note: "legs heavy" },
      ...["2026-10-09", "2026-10-11", "2026-10-13", "2026-10-16", "2026-10-18"].map((date) => ({ date, activityId: "act1", quantity: 4, difficulty: "normal", note: null })),
    ],
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
  it("retries when a reply breaks the format, instead of failing the review", async () => {
    const tooLong = { ...windowOutput("2026-10-19"), summary: "x".repeat(400) };
    const { generate, calls } = fake(tooLong, windowOutput("2026-10-19"));
    const result = await extendWindow({ ...plan, replaceUpcoming: false }, generate);
    expect(result.sessions.length).toBeGreaterThan(0);
    expect(calls[1].prompt).toContain("could not be used");
  });
});
