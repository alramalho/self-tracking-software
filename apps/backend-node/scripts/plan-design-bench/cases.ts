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
    verdict?: "FITS" | "ADJUSTED" | "PUSHBACK";
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
    expect: { paceBasis: "PERFORMANCE_ESTIMATE", targetPreserved: "50" },
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

/** A coached half-marathon plan, a week in, after a hard session: the rolling regeneration case. */
export function extensionCase(plan: { sessions: WindowInput["sessions"] }): WindowInput & { replaceUpcoming: boolean } {
  return {
    goal: "Finish my first half marathon",
    goalSpec: null,
    baseline: {
      text: "Twice a week, about 5 km each. My easy 5 km takes 35–37 minutes. Longest run was 7 km.",
      measurements: [
        { metric: "easy_pace_fast", value: 420, unit: "s/km", sourceQuote: "easy 5 km takes 35–37 minutes" },
        { metric: "easy_pace_slow", value: 444, unit: "s/km", sourceQuote: "easy 5 km takes 35–37 minutes" },
      ],
    },
    outline: { route: "steady", coach: "Helly", phases: [{ title: "Find your rhythm", startWeek: 1, endWeek: 4, progressCheck: "Run 5 km easy twice" }, { title: "Build endurance", startWeek: 5, endWeek: 16, progressCheck: "Long run 15 km" }], assumptions: [], daysMin: 3, daysMax: 3, startDate: START, estimatedWeeks: 20 },
    finishingDate: "2027-02-21",
    activities: [{ id: "running", key: "running", title: "Running", measure: "km", emoji: "🏃" }],
    sessions: plan.sessions,
    results: [
      { date: "2026-10-05", activityId: "running", quantity: 3, difficulty: "normal", note: null },
      { date: "2026-10-07", activityId: "running", quantity: 4, difficulty: "normal", note: null },
      { date: "2026-10-10", activityId: "running", quantity: 6, difficulty: "hard", note: "Last 2 km were a struggle, legs heavy" },
    ],
    approvedHealthContext: null,
    today: "2026-10-12",
    feedback: "The long run felt too hard. Keep the goal, make next week easier.",
    replaceUpcoming: true,
  };
}
