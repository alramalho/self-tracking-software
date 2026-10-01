import type { DesignInput, WindowInput } from "../../src/services/plan-design/types";

/**
 * Synthetic people. Inputs only: what the app would send after the onboarding screens.
 * `expect` lists what a reviewer should be able to see in the output.
 */
const START = "2026-10-05";
const none = { metric: null, value: null, unit: null, text: null, chosenByUser: false };
const run = [{ key: "running", title: "Running", measure: "km", emoji: "🏃" }];

export interface BenchCase {
  id: string;
  title: string;
  /** "mine" = added by the designer of the benchmark, not from the owner's example list. */
  source: "owner-example" | "mine";
  input: DesignInput;
  expect: {
    /** What the coach should say about the preferred days. Defaults to FITS. */
    verdict?: "FITS" | "ADJUSTED" | "PUSHBACK" | ("FITS" | "ADJUSTED" | "PUSHBACK")[];
    paceBasis?: "USER_REPORTED_EASY_PACE" | "PERFORMANCE_ESTIMATE" | "UNKNOWN";
    targetPreserved?: string;
    noInvented?: RegExp;
    onlyOwnResources?: boolean;
    lifting?: boolean;
  };
}

export const cases: BenchCase[] = [
  {
    id: "half-marathon",
    title: "First half marathon · finish only",
    source: "owner-example",
    input: {
      goal: "Finish my first half marathon",
      goalSpec: none,
      baseline: "Twice a week, about 5 km each. My easy 5 km takes 35–37 minutes. Longest run was 7 km.",
      activities: run,
      preferredDays: 4,
      fixedDate: null,
      asked: [{ question: "Do you have a finish time in mind?", answer: "No target in mind" }, { question: "Why does it matter?", answer: "To finish it with my friends" }],
      startDate: START,
    },
    expect: { paceBasis: "USER_REPORTED_EASY_PACE", noInvented: /sub-?\d|negative split/i },
  },
  {
    id: "bench",
    title: "Bench press · user chooses 80 kg × 5",
    source: "owner-example",
    input: {
      goal: "Bench press 80 kg for 5 reps",
      goalSpec: { metric: "LIFT_LOAD", value: 80, unit: "kg", text: "80 kg for 5 reps", chosenByUser: true },
      baseline: "60 kg for 5 reps, 3 sets. I lift 3 days a week, with a rack and a spotter.",
      activities: [{ key: "bench-press", title: "Bench press", measure: "reps", emoji: "🏋️" }],
      preferredDays: 3,
      fixedDate: null,
      asked: [],
      startDate: START,
    },
    expect: { lifting: true, targetPreserved: "80" },
  },
  {
    id: "cutting",
    title: "Cutting · user watches how clothes fit",
    source: "owner-example",
    input: {
      goal: "Lose fat while keeping my strength",
      goalSpec: { metric: "BODY_MEASURE", value: null, unit: null, text: "How my clothes fit, strength kept", chosenByUser: true },
      baseline: "I lift twice a week. Bench press 60 kg for 5 reps. I track my meals.",
      activities: [{ key: "strength-training", title: "Strength training", measure: "minutes", emoji: "🏋️" }],
      preferredDays: 2,
      fixedDate: null,
      asked: [{ question: "Is there something you'd like to watch?", answer: "How clothes fit" }],
      startDate: START,
    },
    expect: { noInvented: /\bBMI\b|\d\s*(kcal|calories)|target weight|\d\s*kg (loss|lost)/i },
  },
  {
    id: "guitar",
    title: "Play a song · only their own chord sheet",
    source: "owner-example",
    input: {
      goal: "Play a complete song smoothly",
      goalSpec: { metric: "SONG", value: 1, unit: "complete playthrough", text: "My own four-chord song (G C D Em)", chosenByUser: true },
      baseline: "I know G, C, D and Em but change slowly. I practise twice a week for 15 minutes. I only have my own chord sheet and a metronome.",
      activities: [{ key: "guitar-practice", title: "Guitar practice", measure: "minutes", emoji: "🎸" }],
      preferredDays: 5,
      fixedDate: null,
      asked: [{ question: "Which song?", answer: "My own four-chord song with a chord sheet" }],
      startDate: START,
    },
    expect: { onlyOwnResources: true, noInvented: /youtube|https?:|justinguitar|\blesson\b/i },
  },
  {
    id: "5k-beginner",
    title: "First 5K · no pace known (mine)",
    source: "mine",
    input: {
      goal: "Run 5 km without stopping",
      goalSpec: { metric: "DISTANCE_NONSTOP", value: 5, unit: "km", text: "5 km without stopping", chosenByUser: true },
      baseline: "I've never really run. I can jog for about 2 minutes before I need to walk.",
      activities: run,
      preferredDays: 2,
      fixedDate: null,
      asked: [],
      startDate: START,
    },
    expect: { paceBasis: "UNKNOWN", targetPreserved: "5" },
  },
  {
    id: "10k-daily",
    title: "10K under 50 min · can train every day (mine)",
    source: "mine",
    input: {
      goal: "Run a 10K in under 50 minutes",
      goalSpec: { metric: "FINISH_TIME", value: 3000, unit: "s", text: "10K in under 50 minutes", chosenByUser: true },
      baseline: "I run most days. I ran a 5K in 26:30 last month. Longest run is 12 km at easy effort.",
      activities: run,
      preferredDays: 7,
      fixedDate: null,
      asked: [],
      startDate: START,
    },
    // A coach may reasonably say seven running days is too many; both answers are acceptable.
    expect: { verdict: ["FITS", "ADJUSTED"], paceBasis: "PERFORMANCE_ESTIMATE", targetPreserved: "50" },
  },
  {
    id: "reality-pushback",
    title: "Half marathon under 1:30, never run, one day a week (mine)",
    source: "mine",
    input: {
      goal: "Finish a half marathon in under 1 hour 30 minutes",
      goalSpec: { metric: "FINISH_TIME", value: 5400, unit: "s", text: "under 1 hour 30 minutes", chosenByUser: true },
      baseline: "I have never run. I can't jog for more than a minute.",
      activities: run,
      preferredDays: 1,
      fixedDate: null,
      asked: [],
      startDate: START,
    },
    expect: { verdict: "PUSHBACK" },
  },
  {
    id: "reality-adjusted",
    title: "First half marathon, one day a week (mine)",
    source: "mine",
    input: {
      goal: "Finish my first half marathon",
      goalSpec: none,
      baseline: "I run 3 km once a week at an easy pace.",
      activities: run,
      preferredDays: 1,
      fixedDate: null,
      asked: [{ question: "Do you have a finish time in mind?", answer: "No target in mind" }],
      startDate: START,
    },
    expect: { verdict: "ADJUSTED" },
  },
];

/**
 * Plan adaptation, from one fixed plan so every model faces the same facts: a first half marathon,
 * Helly's route, 3 runs a week (3, 4, 6 km, then 4, 4, 7 km), easy pace 7:00–7:24 /km.
 * - hard: the long run felt too hard after week 1 → the coach should ease off without stacking.
 * - well: both weeks done and easy → the coach should progress, gradually.
 * - sick: week 2 missed with the flu → the coach should restart lower, not make up the missed runs.
 */
const plannedSessions = [
  ["2026-10-05", 3], ["2026-10-07", 4], ["2026-10-10", 6], ["2026-10-12", 4], ["2026-10-14", 4], ["2026-10-17", 7],
].map(([date, km], i) => ({
  id: `s${i}`, date: date as string, activityId: "running", quantity: km as number, title: i % 3 === 2 ? "Long easy run" : "Easy run",
  targets: { durationMinutes: Math.ceil((km as number) * 7.4) + 6, effort: "easy, can talk", pace: { minSecondsPerKm: 420, maxSecondsPerKm: 444, basis: "USER_REPORTED_EASY_PACE" as const, evidence: "easy 5 km in 35–37 min" }, exercise: null, sets: null, reps: null, loadKg: null, restSeconds: null, progressMeasure: "Finish able to talk in sentences" },
  completed: false,
}));
const logged = (rows: [string, number, string | null, string | null][]) =>
  rows.map(([date, quantity, difficulty, note]) => ({ date, activityId: "running", quantity, difficulty, note }));

export interface AdaptCase {
  id: string;
  title: string;
  expect: string;
  input: WindowInput & { replaceUpcoming: boolean };
}
const base = {
  goal: "Finish my first half marathon",
  goalSpec: null,
  baseline: {
    text: "Twice a week, about 5 km each. My easy 5 km takes 35–37 minutes. Longest run was 7 km.",
    measurements: [
      { metric: "easy_pace_fast", value: 420, unit: "s/km", sourceQuote: "easy 5 km takes 35–37 minutes" },
      { metric: "easy_pace_slow", value: 444, unit: "s/km", sourceQuote: "easy 5 km takes 35–37 minutes" },
    ],
  },
  outline: {
    route: "steady" as const, coach: "Helly" as const,
    phases: [
      { title: "Find your rhythm", startWeek: 1, endWeek: 4, progressCheck: "Run 5 km easy twice in a week" },
      { title: "Build endurance", startWeek: 5, endWeek: 14, progressCheck: "Long run reaches 15 km at easy pace" },
      { title: "Sharpen and taper", startWeek: 15, endWeek: 18, progressCheck: "Last long run 18 km, then two lighter weeks" },
    ],
    assumptions: ["No injury or long break"], daysMin: 3, daysMax: 3, startDate: START, estimatedWeeks: 18,
  },
  finishingDate: "2027-02-07",
  activities: [{ id: "running", key: "running", title: "Running", measure: "km", emoji: "🏃" }],
  approvedHealthContext: null,
};
export const adaptCases: AdaptCase[] = [
  {
    id: "adapt-hard",
    title: "The long run felt too hard",
    expect: "Ease the next two weeks, keep the goal, don't stack what was missed",
    input: {
      ...base,
      sessions: plannedSessions.map((x, i) => ({ ...x, completed: i < 3 })),
      results: logged([["2026-10-05", 3, "normal", null], ["2026-10-07", 4, "normal", null], ["2026-10-10", 6, "hard", "Last 2 km were a struggle, legs heavy"]]),
      today: "2026-10-12",
      feedback: "The long run felt too hard. Keep the goal, make next week easier.",
      replaceUpcoming: true,
    },
  },
  {
    id: "adapt-well",
    title: "Two easy weeks, everything done",
    expect: "Progress gradually (about 10% a week), long run grows a little",
    input: {
      ...base,
      sessions: plannedSessions.map((x) => ({ ...x, completed: true })),
      results: logged([["2026-10-05", 3, "easy", null], ["2026-10-07", 4, "easy", null], ["2026-10-10", 6, "normal", null], ["2026-10-12", 4, "easy", null], ["2026-10-14", 4, "easy", "Felt great"], ["2026-10-17", 7, "normal", "Comfortable the whole way"]]),
      today: "2026-10-18",
      feedback: null,
      replaceUpcoming: false,
    },
  },
  {
    id: "adapt-well-oli",
    title: "Two easy weeks, everything done, with Oli",
    expect: "Oli may grow faster than Helly (about 15% a week, at most 25% over two weeks); no single run more than a small step past the longest",
    input: {
      ...base,
      outline: { ...base.outline, route: "focused" as const, coach: "Oli" as const },
      sessions: plannedSessions.map((x) => ({ ...x, completed: true })),
      results: logged([["2026-10-05", 3, "easy", null], ["2026-10-07", 4, "easy", null], ["2026-10-10", 6, "normal", null], ["2026-10-12", 4, "easy", null], ["2026-10-14", 4, "easy", "Felt great"], ["2026-10-17", 7, "normal", "Comfortable the whole way"]]),
      today: "2026-10-18",
      feedback: null,
      replaceUpcoming: false,
    },
  },
  {
    id: "adapt-sick",
    title: "Missed week 2 with the flu",
    expect: "Restart below where they were, don't make up missed runs, check in on recovery",
    input: {
      ...base,
      sessions: plannedSessions.map((x, i) => ({ ...x, completed: i < 3 })),
      results: logged([["2026-10-05", 3, "easy", null], ["2026-10-07", 4, "normal", null], ["2026-10-10", 6, "normal", null]]),
      today: "2026-10-18",
      feedback: "Had the flu all week, feeling better now.",
      replaceUpcoming: false,
    },
  },
];
