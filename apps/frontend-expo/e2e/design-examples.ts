import type {
  BaselineMeasurement,
  DesignOption,
  DesignSession,
  GoalSpec,
  PlanOrientation,
  SessionTargets,
  SubgoalQuestion,
} from "@tsw/prisma/follow-through";

/**
 * ILLUSTRATIVE examples, written by hand. They show what the system is meant to understand and
 * produce, and they drive the screenshots. They are NOT model output. Real generations live in
 * the benchmark section of the report.
 */
export interface DesignExample {
  id: string;
  title: string;
  goal: string;
  orientation: PlanOrientation;
  activity: { key: string; title: string; measure: string; emoji: string };
  baselineQuestion: string;
  baselineAnswer: string;
  baselineMeasurements: BaselineMeasurement[];
  goalSpec: GoalSpec;
  subgoal: { question: SubgoalQuestion; answer: string } | null;
  availableDays: number;
  options: DesignOption[];
  note: string;
}

const START = "2026-10-05";
const addDay = (n: number) => new Date(Date.parse(`${START}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const PATTERN: Record<number, number[]> = { 1: [0], 2: [0, 4], 3: [0, 2, 5], 4: [0, 1, 3, 5], 5: [0, 1, 2, 4, 5], 6: [0, 1, 2, 3, 5, 6], 7: [0, 1, 2, 3, 4, 5, 6] };
const days = (n: number) => [...PATTERN[n], ...PATTERN[n].map((d) => d + 7)];
const nulls = { exercise: null, sets: null, reps: null, loadKg: null, restSeconds: null };

function runSession(offset: number, km: number, title: string, guide: string, check: string): DesignSession {
  const targets: SessionTargets = {
    ...nulls,
    durationMinutes: Math.ceil((km * 444) / 60) + 6,
    effort: title.startsWith("Long") ? "easy, can talk the whole way" : "easy, can talk in sentences",
    pace: { minSecondsPerKm: 420, maxSecondsPerKm: 444, basis: "USER_REPORTED_EASY_PACE", evidence: "You told us: easy 5 km in 35–37 min" },
    progressMeasure: check,
  };
  return { date: addDay(offset), activity: "running", quantity: km, title, descriptiveGuide: guide, targets };
}
const easy = "Walk 5 minutes, then run at a pace where you could hold a conversation. Finish with a short walk. If you can't talk, slow down.";
const longRun = "Go slower than feels necessary and take walk breaks if you want them. The only goal is to finish comfortable enough to do it again.";
const runOption = (id: "steady" | "focused", perWeek: number[][], weeks: number, daysPerWeek: number, rationale: string): DesignOption => ({
  id,
  coach: id === "steady" ? "Helly" : "Oli",
  trainingDaysPerWeek: daysPerWeek,
  estimatedWeeks: weeks,
  finishingDate: addDay(weeks * 7 - 1),
  rationale,
  assumptions: ["No injury or long break", "Weekly distance grows about 10%"],
  phases: [
    { title: "Find your rhythm", startWeek: 1, endWeek: 4, progressCheck: "Run 5 km easy twice in a week without stopping" },
    { title: "Build endurance", startWeek: 5, endWeek: weeks - 4, progressCheck: "Long run reaches 15 km at easy pace" },
    { title: "Sharpen and taper", startWeek: weeks - 3, endWeek: weeks, progressCheck: "Last long run 18 km, then two lighter weeks" },
  ],
  sessions: days(daysPerWeek).map((offset, i) => {
    const km = perWeek[Math.floor(i / daysPerWeek)][i % daysPerWeek];
    return i % daysPerWeek === daysPerWeek - 1
      ? runSession(offset, km, "Long easy run", longRun, "Finish able to say a full sentence")
      : runSession(offset, km, "Easy run", easy, "Note how your legs feel the next morning");
  }),
});

const lift = (offset: number, sets: number, reps: number, loadKg: number, title: string, guide: string): DesignSession => ({
  date: addDay(offset),
  activity: "bench-press",
  quantity: sets * reps,
  title,
  descriptiveGuide: guide,
  targets: { durationMinutes: 50, effort: `last rep of each set leaves 1–2 in reserve`, pace: null, exercise: "Bench press", sets, reps, loadKg, restSeconds: 150, progressMeasure: "Log the top set. If all reps moved well, add 2.5 kg next week" },
});

const gc = (offset: number, minutes: number, title: string, guide: string, check: string): DesignSession => ({
  date: addDay(offset),
  activity: "guitar-practice",
  quantity: minutes,
  title,
  descriptiveGuide: guide,
  targets: { ...nulls, durationMinutes: minutes, effort: "slow and clean, metronome at 60", pace: null, progressMeasure: check },
});

export const examples: DesignExample[] = [
  {
    id: "half-marathon",
    title: "First half marathon · finish only",
    goal: "Finish my first half marathon",
    orientation: "OUTCOME",
    activity: { key: "running", title: "Running", measure: "km", emoji: "🏃" },
    baselineQuestion: "How much do you run now?",
    baselineAnswer: "Twice a week, about 5 km each. My easy 5 km takes 35–37 minutes. Longest run was 7 km.",
    baselineMeasurements: [
      { metric: "easy_pace_fast", value: 420, unit: "s/km", sourceQuote: "easy 5 km takes 35–37 minutes" },
      { metric: "easy_pace_slow", value: 444, unit: "s/km", sourceQuote: "easy 5 km takes 35–37 minutes" },
      { metric: "longest_run", value: 7, unit: "km", sourceQuote: "Longest run was 7 km" },
    ],
    goalSpec: { metric: null, value: null, unit: null, text: null, chosenByUser: false },
    subgoal: {
      question: { kind: "FINISH_TIME", title: "Do you have a finish time in mind?", choices: ["Under 2 hours", "Under 2:30", "No target in mind"] },
      answer: "No target in mind",
    },
    availableDays: 4,
    options: [
      runOption("steady", [[3, 4, 6], [4, 4, 7]], 20, 3, "Three easy runs build from your two-run routine, with a rest day between most of them."),
      runOption("focused", [[3, 3, 4, 6], [3, 4, 4, 7]], 16, 4, "A fourth day spreads the work in shorter runs, so the finish comes four weeks earlier."),
    ],
    note: "No finish time was chosen, so none is invented. Paces come from the person's own 35–37 min easy 5 km.",
  },
  {
    id: "bench",
    title: "Bench press · user chooses 80 kg × 5",
    goal: "Bench press 80 kg for 5 reps",
    orientation: "OUTCOME",
    activity: { key: "bench-press", title: "Bench press", measure: "reps", emoji: "🏋️" },
    baselineQuestion: "What do you bench now?",
    baselineAnswer: "60 kg for 5 reps, 3 sets. I lift 3 days a week, with a rack and a spotter.",
    baselineMeasurements: [
      { metric: "bench_load", value: 60, unit: "kg", sourceQuote: "60 kg for 5 reps" },
      { metric: "bench_reps", value: 5, unit: "reps", sourceQuote: "60 kg for 5 reps, 3 sets" },
    ],
    goalSpec: { metric: "LIFT_LOAD", value: 80, unit: "kg", text: "80 kg for 5 reps", chosenByUser: true },
    subgoal: null,
    availableDays: 3,
    options: [
      {
        id: "steady",
        coach: "Helly",
        trainingDaysPerWeek: 3,
        estimatedWeeks: 16,
        finishingDate: addDay(16 * 7 - 1),
        rationale: "One small jump every two weeks, on your existing three lifting days.",
        assumptions: ["Sleep and food stay steady", "Spotter available on heavy days"],
        phases: [
          { title: "Groove", startWeek: 1, endWeek: 4, progressCheck: "3×5 at 65 kg with all reps smooth" },
          { title: "Build", startWeek: 5, endWeek: 12, progressCheck: "3×5 at 75 kg" },
          { title: "Peak", startWeek: 13, endWeek: 16, progressCheck: "One set of 5 at 80 kg" },
        ],
        sessions: [
          lift(0, 3, 5, 62.5, "Bench day", "Warm up with two light sets, then three sets of five. Stop a set if bar speed drops hard."),
          lift(2, 4, 4, 57.5, "Volume day", "Lighter weight, one extra set, crisp reps with a short pause on the chest."),
          lift(5, 3, 5, 62.5, "Bench day", "Same as Monday. If all fifteen reps were smooth, add 2.5 kg next week."),
          lift(7, 3, 5, 62.5, "Bench day", "Repeat the load. Quality of the pause on the chest matters more than speed."),
          lift(9, 4, 4, 57.5, "Volume day", "Lighter weight, four sets, stay tight through the shoulders."),
          lift(12, 3, 5, 65, "Bench day", "New load if last week was clean. Keep 1–2 reps in reserve."),
        ],
      },
      {
        id: "focused",
        coach: "Oli",
        trainingDaysPerWeek: 3,
        estimatedWeeks: 12,
        finishingDate: addDay(12 * 7 - 1),
        rationale: "Heavier jumps each week, so it only works if recovery holds.",
        assumptions: ["Sleep and food stay steady", "You can miss a week without a stall"],
        phases: [
          { title: "Groove", startWeek: 1, endWeek: 3, progressCheck: "3×5 at 65 kg" },
          { title: "Build", startWeek: 4, endWeek: 9, progressCheck: "3×5 at 75 kg" },
          { title: "Peak", startWeek: 10, endWeek: 12, progressCheck: "One set of 5 at 80 kg" },
        ],
        sessions: [
          lift(0, 3, 5, 65, "Heavy day", "Three sets of five at a weight you can repeat. Rest two and a half minutes between sets."),
          lift(2, 4, 4, 60, "Volume day", "Four crisp sets of four at a lighter load."),
          lift(5, 3, 5, 65, "Heavy day", "Repeat Monday. If it felt easy, say so in your log."),
          lift(7, 3, 5, 67.5, "Heavy day", "Add 2.5 kg. Keep 1 rep in reserve on the last set."),
          lift(9, 4, 4, 62.5, "Volume day", "Four sets of four, slightly heavier than last week."),
          lift(12, 3, 5, 67.5, "Heavy day", "Hold the load and aim for cleaner reps."),
        ],
      },
    ],
    note: "The chosen target (80 kg × 5) is kept exactly. Sets × reps × load and rest are stored per session.",
  },
  {
    id: "cutting",
    title: "Cutting · user declines a number",
    goal: "Lose fat while keeping my strength",
    orientation: "OUTCOME",
    activity: { key: "strength-training", title: "Strength training", measure: "minutes", emoji: "🏋️" },
    baselineQuestion: "What do you do now?",
    baselineAnswer: "I lift twice a week. Bench press 60 kg for 5 reps. I track my meals.",
    baselineMeasurements: [{ metric: "bench_load", value: 60, unit: "kg", sourceQuote: "Bench press 60 kg for 5 reps" }],
    goalSpec: { metric: null, value: null, unit: null, text: "How my clothes fit, strength kept", chosenByUser: true },
    subgoal: {
      question: { kind: "BODY_MEASURE", title: "Is there something you'd like to watch?", choices: ["The scale", "My waist", "How clothes fit", "No number in mind"] },
      answer: "How clothes fit",
    },
    availableDays: 2,
    options: [
      {
        id: "steady",
        coach: "Helly",
        trainingDaysPerWeek: 2,
        estimatedWeeks: 14,
        finishingDate: addDay(14 * 7 - 1),
        rationale: "Two full-body sessions that hold your strength while you eat a little less. No target weight is set.",
        assumptions: ["You choose how to eat; we only watch that strength holds", "Review in week 4"],
        phases: [
          { title: "Hold strength", startWeek: 1, endWeek: 6, progressCheck: "Bench stays at 60 kg for 5 reps" },
          { title: "Check the trend", startWeek: 7, endWeek: 14, progressCheck: "Clothes fit looser and lifts have not dropped" },
        ],
        sessions: [
          { date: addDay(0), activity: "strength-training", quantity: 40, title: "Full body A", descriptiveGuide: "Bench 3×5 at 60 kg, row 3×8, squat 3×5. Stop each set with one rep left.", targets: { ...nulls, exercise: "Bench press", sets: 3, reps: 5, loadKg: 60, restSeconds: 150, durationMinutes: 40, effort: "hard but clean, 1 rep in reserve", pace: null, progressMeasure: "Top bench set stays at 60 kg × 5" } },
          { date: addDay(3), activity: "strength-training", quantity: 40, title: "Full body B", descriptiveGuide: "Overhead press 3×6, deadlift 2×5, pull-ups 3 sets to 1 rep short of failure.", targets: { ...nulls, exercise: "Deadlift", sets: 2, reps: 5, loadKg: null, restSeconds: 180, durationMinutes: 40, effort: "hard but clean, 1 rep in reserve", pace: null, progressMeasure: "Write down the weights; none should drop" } },
          { date: addDay(7), activity: "strength-training", quantity: 40, title: "Full body A", descriptiveGuide: "Same as last week. If every rep moved well, keep the load; do not add.", targets: { ...nulls, exercise: "Bench press", sets: 3, reps: 5, loadKg: 60, restSeconds: 150, durationMinutes: 40, effort: "hard but clean, 1 rep in reserve", pace: null, progressMeasure: "Top bench set stays at 60 kg × 5" } },
          { date: addDay(10), activity: "strength-training", quantity: 40, title: "Full body B", descriptiveGuide: "Same as last week. Note how your jeans or waistband feel today.", targets: { ...nulls, exercise: "Deadlift", sets: 2, reps: 5, loadKg: null, restSeconds: 180, durationMinutes: 40, effort: "hard but clean, 1 rep in reserve", pace: null, progressMeasure: "Write one line on how clothes fit" } },
        ],
      },
      {
        id: "focused",
        coach: "Oli",
        trainingDaysPerWeek: 2,
        estimatedWeeks: 10,
        finishingDate: addDay(10 * 7 - 1),
        rationale: "Same two days with a third short finisher each session. The road is shorter; the watch-point is identical.",
        assumptions: ["You keep sleeping well", "Review in week 3"],
        phases: [
          { title: "Hold strength", startWeek: 1, endWeek: 4, progressCheck: "Bench stays at 60 kg for 5 reps" },
          { title: "Check the trend", startWeek: 5, endWeek: 10, progressCheck: "Clothes fit looser and lifts have not dropped" },
        ],
        sessions: [
          { date: addDay(0), activity: "strength-training", quantity: 55, title: "Full body A + finisher", descriptiveGuide: "Bench 3×5 at 60 kg, row 3×8, squat 3×5, then 10 minutes of easy bike.", targets: { ...nulls, exercise: "Bench press", sets: 3, reps: 5, loadKg: 60, restSeconds: 150, durationMinutes: 55, effort: "hard but clean, 1 rep in reserve", pace: null, progressMeasure: "Top bench set stays at 60 kg × 5" } },
          { date: addDay(3), activity: "strength-training", quantity: 55, title: "Full body B + finisher", descriptiveGuide: "Overhead press 3×6, deadlift 2×5, pull-ups, then 10 minutes of easy bike.", targets: { ...nulls, exercise: "Deadlift", sets: 2, reps: 5, loadKg: null, restSeconds: 180, durationMinutes: 55, effort: "hard but clean, 1 rep in reserve", pace: null, progressMeasure: "Write down the weights; none should drop" } },
          { date: addDay(7), activity: "strength-training", quantity: 55, title: "Full body A + finisher", descriptiveGuide: "Same as last week. Keep the load the same.", targets: { ...nulls, exercise: "Bench press", sets: 3, reps: 5, loadKg: 60, restSeconds: 150, durationMinutes: 55, effort: "hard but clean, 1 rep in reserve", pace: null, progressMeasure: "Top bench set stays at 60 kg × 5" } },
          { date: addDay(10), activity: "strength-training", quantity: 55, title: "Full body B + finisher", descriptiveGuide: "Same as last week. Note how your clothes fit today.", targets: { ...nulls, exercise: "Deadlift", sets: 2, reps: 5, loadKg: null, restSeconds: 180, durationMinutes: 55, effort: "hard but clean, 1 rep in reserve", pace: null, progressMeasure: "Write one line on how clothes fit" } },
        ],
      },
    ],
    note: "The person declined a number, so the success measure is the one they chose. No BMI, weight or calorie target is proposed.",
  },
  {
    id: "guitar",
    title: "Play a song · only their own chord sheet",
    goal: "Play a complete song smoothly",
    orientation: "OUTCOME",
    activity: { key: "guitar-practice", title: "Guitar practice", measure: "minutes", emoji: "🎸" },
    baselineQuestion: "What can you play now?",
    baselineAnswer: "I know G, C, D and Em but change slowly. I practise twice a week for 15 minutes.",
    baselineMeasurements: [{ metric: "practice_minutes", value: 15, unit: "min", sourceQuote: "practise twice a week for 15 minutes" }],
    goalSpec: { metric: "SONG", value: 1, unit: "complete playthrough", text: "My own four-chord song (G C D Em)", chosenByUser: true },
    subgoal: {
      question: { kind: "SONG", title: "Which song?", choices: ["My own song", "A song I know", "No target in mind"] },
      answer: "My own four-chord song with a chord sheet",
    },
    availableDays: 5,
    options: [
      {
        id: "steady",
        coach: "Helly",
        trainingDaysPerWeek: 4,
        estimatedWeeks: 8,
        finishingDate: addDay(8 * 7 - 1),
        rationale: "Short daily practice on chord changes, then the song in pieces.",
        assumptions: ["Only your chord sheet and a metronome are used", "We can't hear you; you judge each step"],
        phases: [
          { title: "Clean changes", startWeek: 1, endWeek: 3, progressCheck: "G→C and D→Em four times in a row at 60 bpm" },
          { title: "Verse and chorus", startWeek: 4, endWeek: 6, progressCheck: "Play the verse twice without stopping" },
          { title: "Whole song", startWeek: 7, endWeek: 8, progressCheck: "One complete playthrough at 70 bpm" },
        ],
        sessions: days(4).map((d, i) => gc(d, i % 2 ? 15 : 12, i % 2 ? "Song piece" : "Chord changes", i % 2 ? "Play the first four bars of your sheet with the metronome at 60. Repeat until you can do it twice cleanly." : "Switch G→C and D→Em for 12 minutes at 60 bpm. Reset if you stop.", i % 2 ? "Count clean runs of four bars" : "Count clean switches in a row")),
      },
      {
        id: "focused",
        coach: "Oli",
        trainingDaysPerWeek: 5,
        estimatedWeeks: 6,
        finishingDate: addDay(6 * 7 - 1),
        rationale: "Five days of 20 minutes, with the song introduced in week 2.",
        assumptions: ["Only your chord sheet and a metronome are used", "We can't hear you; you judge each step"],
        phases: [
          { title: "Clean changes", startWeek: 1, endWeek: 2, progressCheck: "G→C and D→Em six times in a row at 60 bpm" },
          { title: "Verse and chorus", startWeek: 3, endWeek: 5, progressCheck: "Play verse and chorus without stopping" },
          { title: "Whole song", startWeek: 6, endWeek: 6, progressCheck: "One complete playthrough at 70 bpm" },
        ],
        sessions: days(5).map((d, i) => gc(d, 20, i % 2 ? "Song piece" : "Chord changes", i % 2 ? "Play the first eight bars of your sheet with the metronome at 60. Repeat until you can do it twice cleanly." : "Switch G→C, D→Em and Em→G for 20 minutes at 60 bpm. Reset if you stop.", i % 2 ? "Count clean runs of eight bars" : "Count clean switches in a row")),
      },
    ],
    note: "Only the person's own chord sheet is referenced. No links, lessons or claims about hearing the playing.",
  },
  {
    id: "consistency",
    title: "Train four times a week · consistency",
    goal: "Train 4x a week",
    orientation: "CONSISTENCY",
    activity: { key: "strength-training", title: "Strength training", measure: "minutes", emoji: "🏋️" },
    baselineQuestion: "How often do you train now?",
    baselineAnswer: "Two sessions a week, 40 minutes each.",
    baselineMeasurements: [{ metric: "sessions_per_week", value: 2, unit: "per week", sourceQuote: "Two sessions a week" }],
    goalSpec: { metric: "WEEKLY_SESSIONS", value: 4, unit: "per week", text: "4 times a week", chosenByUser: true },
    subgoal: null,
    availableDays: 4,
    options: [],
    note: "No finish line, so no two routes and no dated sessions: a weekly target with a coach who adjusts it as weeks go by.",
  },
];

export const exampleFor = (goal: string) =>
  examples.find((e) => e.goal.toLowerCase() === goal.trim().toLowerCase()) ??
  examples.find((e) => /half marathon|run/i.test(goal) && e.id === "half-marathon") ??
  examples.find((e) => /bench/i.test(goal) && e.id === "bench") ??
  examples.find((e) => /fat|cut|lose/i.test(goal) && e.id === "cutting") ??
  examples.find((e) => /guitar|song/i.test(goal) && e.id === "guitar") ??
  (/\b\d\s*x|times a week|every day|daily/i.test(goal) ? examples[4] : examples[0]);

export const startDate = START;
