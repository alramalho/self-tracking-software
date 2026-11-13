/**
 * Voice note → activity log cases. Text only (the transcript as speech-to-text would return it), so the
 * benchmark measures matching and extraction, not transcription.
 *
 * The main catalog is the owner's real activity list (titles, measures and last-logged dates on 12 Nov 2026;
 * ids replaced by slugs). "real" cases are transcripts saved in production; the rest are written from how
 * the owner actually logs (running in kilometers, meditation in minutes, gym in sessions), in English and
 * Portuguese, including the failure the owner reported (a run that wasn't extracted).
 */
import type { VoiceLogActivityContext, VoiceLogMetricContext } from "../../src/services/voice-log/extract";
import type { VoiceLogRefinementContext } from "../../src/services/voice-log/types";

export const NOW = new Date("2026-11-12T19:00:00.000Z"); // Thursday 20:00 in Berlin
export const TIMEZONE = "Europe/Berlin";
export const TODAY = "2026-11-12";
export const YESTERDAY = "2026-11-11";

const a = (activityId: string, title: string, measure: string, lastLoggedOn: string | null = null): VoiceLogActivityContext => ({
  activityId,
  title,
  emoji: "",
  measure,
  lastLoggedOn,
});

export const ownerActivities: VoiceLogActivityContext[] = [
  a("beat-producing", "beat producing", "hours"),
  a("bouldering", "bouldering", "sessions", "2025-09-14"),
  a("chess", "Chess", "minutes", "2026-02-10"),
  a("cycling", "cycling", "minutes", "2026-06-24"),
  a("deep-learning", "Deep Learning Theory", "minutes", "2026-06-05"),
  a("guitar", "guitar", "minutes", "2026-11-05"),
  a("gym", "gym", "sessions", "2026-11-07"),
  a("hiit", "HIIT", "minutes", "2025-09-12"),
  a("hike", "Hike", "Minutes", "2025-11-13"),
  a("hiking", "Hiking", "minutes", "2026-10-11"),
  a("home-workout", "home workout", "minutes", "2026-04-11"),
  a("kayaking", "kayaking", "minutes", "2025-05-10"),
  a("leetcode", "LeetCode Practice", "minutes", "2026-06-05"),
  a("meditate", "meditate", "minutes", "2026-11-10"),
  a("music-writing", "music writing", "bars", "2024-11-18"),
  a("outside-workout", "outside workout", "minutes", "2025-12-31"),
  a("reading", "reading", "pages", "2025-09-17"),
  a("robotics", "Robotics (DC Theory & Arduino)", "minutes", "2026-06-06"),
  a("running", "running", "kilometers", "2026-11-12"),
  a("sauna", "sauna", "minutes", "2025-11-02"),
  a("skating", "skating", "minutes", "2024-10-30"),
  a("surf", "Surf", "Minutes", "2025-11-21"),
  a("swimming", "swimming", "minutes", "2025-07-03"),
  a("system-design", "System Design (Gaurav Sen)", "minutes", "2026-06-04"),
  a("voice-producing", "voice producing", "hours"),
  a("wood-splitting", "wood splitting", "minutes", "2025-02-03"),
  a("side-project", "work on side project", "hours", "2024-12-31"),
  a("write-music", "write music", "minutes", "2024-12-08"),
  a("writing", "writing", "minutes", "2026-01-10"),
  a("yoga", "Yoga", "Minutes", "2026-10-23"),
];

export const ownerMetrics: VoiceLogMetricContext[] = [
  { metricId: "happiness", title: "Happiness", emoji: "" },
  { metricId: "energy", title: "Energy", emoji: "" },
  { metricId: "productivity", title: "Productivity", emoji: "" },
];

/** A second, smaller catalog with differently named activities, so the prompt isn't tuned to one person. */
const otherActivities: VoiceLogActivityContext[] = [
  a("run", "Run", "km", "2026-11-10"),
  a("walk", "Walk", "minutes", "2026-11-11"),
  a("strength", "Strength training", "workouts", "2026-11-09"),
  a("pushups", "Push-ups", "reps", "2026-11-11"),
  a("water", "Drink water", "glasses", "2026-11-12"),
];

export type ExpectedActivity = {
  /** Any of these ids is right (near-duplicate activities). */
  id: string | string[];
  /** Exact quantity, any of the listed values, or a range (for estimates). */
  quantity: number | number[] | { min: number; max: number };
  date?: string;
  /** true: must be marked as an estimate from another unit; false: must not be. Unset: not checked. */
  estimated?: boolean;
};

export type BenchCase = {
  id: string;
  source: "real" | "written";
  transcript: string;
  activities?: VoiceLogActivityContext[];
  metrics?: VoiceLogMetricContext[];
  /** A spoken correction of an existing draft: transcript is the correction. */
  refinement?: VoiceLogRefinementContext;
  expect: {
    activities: ExpectedActivity[];
    metrics?: { id: string; rating: number | number[] }[];
    /** The run/swim etc. must show up in unresolved (an amount the model must not guess). */
    unresolvedMentions?: RegExp;
    /** Details that must be kept in the matching activity's description, e.g. the time of a run. */
    descriptionMentions?: { id: string; pattern: RegExp };
  };
};

export const cases: BenchCase[] = [
  // Saved in production (8 and 10 Nov).
  { id: "real-meditation-lock", source: "real", transcript: "Lock 22 minutes of meditation.", expect: { activities: [{ id: "meditate", quantity: 22 }] } },
  {
    // The saved note (10 Nov) with the amount that was logged; the exact transcript wasn't stored.
    id: "real-meditation-reflection",
    source: "real",
    transcript:
      "Just meditated for 30 minutes. My mind raced a lot between my project, Better Groceries, and the system design topic I forgot to study, particularly Cassandra. But things felt good. Meditation felt important and gave me clarity.",
    expect: { activities: [{ id: "meditate", quantity: 30 }] },
  },

  // Running: the owner's main activity, logged in kilometers.
  // 13 Nov, from the watch: "Log" heard as "Long", reading is tracked in pages. Logged nothing before.
  { id: "real-reading-long", source: "real", transcript: "Long half an hour of reading.", expect: { activities: [{ id: "reading", quantity: { min: 12, max: 30 }, estimated: true }] } },
  { id: "reading-minutes-pt", source: "written", transcript: "Li durante uma hora.", expect: { activities: [{ id: "reading", quantity: { min: 25, max: 60 }, estimated: true }] } },
  { id: "reading-pages-not-estimated", source: "written", transcript: "Log 12 pages of reading.", expect: { activities: [{ id: "reading", quantity: 12, estimated: false }] } },
  { id: "run-plain-km", source: "written", transcript: "I went for a run today, five kilometers.", expect: { activities: [{ id: "running", quantity: 5 }] } },
  { id: "run-5k", source: "written", transcript: "Did a 5k this morning, felt pretty good.", expect: { activities: [{ id: "running", quantity: 5 }] } },
  { id: "run-decimal", source: "written", transcript: "Log a run, 5.4 kilometers along the river.", expect: { activities: [{ id: "running", quantity: 5 }] } },
  { id: "run-decimal-up", source: "written", transcript: "Ran 7.8 km at an easy pace.", expect: { activities: [{ id: "running", quantity: 8 }] } },
  { id: "run-spoken-number", source: "written", transcript: "Ran nine K yesterday evening.", expect: { activities: [{ id: "running", quantity: 9, date: YESTERDAY }] } },
  { id: "run-weekday", source: "written", transcript: "On Sunday I ran ten kilometers.", expect: { activities: [{ id: "running", quantity: 10, date: "2026-11-08" }] } },
  { id: "run-miles", source: "written", transcript: "Morning run, three miles.", expect: { activities: [{ id: "running", quantity: 5 }] } },
  { id: "run-half-marathon", source: "written", transcript: "I ran a half marathon today!", expect: { activities: [{ id: "running", quantity: 21 }] } },
  { id: "run-with-time", source: "written", transcript: "10K run in 52 minutes, it was really hard at the end.", expect: { activities: [{ id: "running", quantity: 10 }] } },
  // A duration for an activity tracked in distance: log an estimate the user can correct (owner's choice, 13 Nov).
  { id: "run-duration-only", source: "written", transcript: "I went running for about 30 minutes.", expect: { activities: [{ id: "running", quantity: { min: 4, max: 6 }, estimated: true }] } },
  { id: "run-no-amount", source: "written", transcript: "Went for a run.", expect: { activities: [], unresolvedMentions: /run/i } },
  { id: "run-jog", source: "written", transcript: "Quick jog around the park, like four kilometers.", expect: { activities: [{ id: "running", quantity: 4 }] } },
  { id: "run-pt", source: "written", transcript: "Fui correr hoje, fiz seis quilómetros.", expect: { activities: [{ id: "running", quantity: 6 }] } },
  { id: "run-pt-yesterday", source: "written", transcript: "Corri 12 km ontem.", expect: { activities: [{ id: "running", quantity: 12, date: YESTERDAY }] } },
  { id: "run-filler", source: "written", transcript: "Uh so yeah, um, I did my run, it was, uh, eight kilometers, and then I stretched a bit.", expect: { activities: [{ id: "running", quantity: 8 }] } },

  // Other activities.
  { id: "gym-session", source: "written", transcript: "Gym session this morning, legs and core.", expect: { activities: [{ id: "gym", quantity: 1 }] } },
  { id: "gym-duration", source: "written", transcript: "Lifted weights for an hour and a half.", expect: { activities: [{ id: "gym", quantity: 1 }] } },
  { id: "hike-duplicate", source: "written", transcript: "Did a hike, about two hours.", expect: { activities: [{ id: ["hiking", "hike"], quantity: 120 }] } },
  { id: "guitar", source: "written", transcript: "Played guitar for half an hour.", expect: { activities: [{ id: "guitar", quantity: 30 }] } },
  { id: "reading", source: "written", transcript: "Read 20 pages before bed.", expect: { activities: [{ id: "reading", quantity: 20 }] } },
  { id: "two-activities", source: "written", transcript: "Did LeetCode for 45 minutes and then an hour of system design.", expect: { activities: [{ id: "leetcode", quantity: 45 }, { id: "system-design", quantity: 60 }] } },
  { id: "surf", source: "written", transcript: "Surfed for an hour and a half, waves were great.", expect: { activities: [{ id: "surf", quantity: 90 }] } },
  { id: "cycling-each-way", source: "written", transcript: "Cycled to work, 25 minutes each way.", expect: { activities: [{ id: "cycling", quantity: 50 }] } },
  { id: "bars-vs-minutes", source: "written", transcript: "Wrote 16 bars of a new track.", expect: { activities: [{ id: "music-writing", quantity: 16 }] } },
  { id: "side-project-hours", source: "written", transcript: "Worked on Better Groceries for three hours.", expect: { activities: [{ id: "side-project", quantity: 3 }] } },
  { id: "sauna-plus-unknown", source: "written", transcript: "Sauna for 15 minutes and then a cold plunge.", expect: { activities: [{ id: "sauna", quantity: 15 }] } },
  { id: "swim-distance", source: "written", transcript: "Swam 1.5 kilometers.", expect: { activities: [{ id: "swimming", quantity: { min: 25, max: 50 }, estimated: true }] } },
  { id: "meditation-pt", source: "written", transcript: "Meditei 15 minutos esta manhã.", expect: { activities: [{ id: "meditate", quantity: 15 }] } },
  { id: "run-and-gym-pt", source: "written", transcript: "Hoje corri cinco quilómetros e depois fui ao ginásio.", expect: { activities: [{ id: "running", quantity: 5 }, { id: "gym", quantity: 1 }] } },
  { id: "plan-only", source: "written", transcript: "Tomorrow I'm going to run 10 kilometers and go to the gym.", expect: { activities: [] } },
  { id: "yoga-energy", source: "written", transcript: "Yoga for 20 minutes, energy is like four out of five.", expect: { activities: [{ id: "yoga", quantity: 20 }], metrics: [{ id: "energy", rating: 4 }] } },
  { id: "reflection-only", source: "written", transcript: "Feeling a bit stressed about work lately, I think I need more sleep.", expect: { activities: [] } },

  // Harder: decimals, corrections, details, mishearings, several things in one note.
  { id: "hard-decimal-comma-pt", source: "written", transcript: "Corri 5,6 km hoje de manhã.", expect: { activities: [{ id: "running", quantity: 6 }] } },
  { id: "hard-decimal-words-pt", source: "written", transcript: "Fiz uma corrida de oito vírgula dois quilómetros.", expect: { activities: [{ id: "running", quantity: 8 }] } },
  { id: "hard-point-k", source: "written", transcript: "Just finished a six point three K run.", expect: { activities: [{ id: "running", quantity: 6 }] } },
  { id: "hard-self-correction", source: "written", transcript: "I ran six, no wait, seven kilometers today.", expect: { activities: [{ id: "running", quantity: 7 }] } },
  { id: "hard-time-and-pace", source: "written", transcript: "Ran 5 km in 26 minutes, pace around 5:12, legs felt heavy.", expect: { activities: [{ id: "running", quantity: 5 }], descriptionMentions: { id: "running", pattern: /26/ } } },
  { id: "hard-time-and-distance-pt", source: "written", transcript: "Corrida de 40 minutos, mais ou menos 7 quilómetros, junto ao rio.", expect: { activities: [{ id: "running", quantity: 7 }], descriptionMentions: { id: "running", pattern: /40/ } } },
  { id: "hard-run-walk", source: "written", transcript: "Ran 4 kilometers out and walked the 4 kilometers back.", expect: { activities: [{ id: "running", quantity: 4 }] } },
  { id: "hard-intervals", source: "written", transcript: "Interval session on the track: warm-up 2 km, 6 times 800 meters, cool-down 2 km.", expect: { activities: [{ id: "running", quantity: [8, 9] }], descriptionMentions: { id: "running", pattern: /800/ } } },
  { id: "hard-two-runs", source: "written", transcript: "Two runs today, 3 km in the morning and 5 km in the evening.", expect: { activities: [{ id: "running", quantity: 8 }] } },
  { id: "hard-mishear-ran", source: "written", transcript: "Rand ten kilometres with Jo, Sunday long run.", expect: { activities: [{ id: "running", quantity: 10, date: "2026-11-08" }] } },
  { id: "hard-mishear-log", source: "written", transcript: "Locked a run of 6 K.", expect: { activities: [{ id: "running", quantity: 6 }] } },
  { id: "hard-yesterday-and-today", source: "written", transcript: "Yesterday I did gym, today I ran 5 kilometers.", expect: { activities: [{ id: "gym", quantity: 1, date: YESTERDAY }, { id: "running", quantity: 5 }] } },
  { id: "hard-long-note", source: "written", transcript: "Okay so today was a good day. Woke up early, meditated for like ten minutes, then went for a run, it was 7 and a half kilometers, then in the afternoon I worked on my side project for about two hours. Energy was pretty high, I'd say four.", expect: { activities: [{ id: "meditate", quantity: 10 }, { id: "running", quantity: 8 }, { id: "side-project", quantity: 2 }], metrics: [{ id: "energy", rating: 4 }] } },
  { id: "hard-treadmill", source: "written", transcript: "Did 5 km on the treadmill at the gym, nothing else.", expect: { activities: [{ id: "running", quantity: 5 }] } },
  { id: "hard-hours-minutes", source: "written", transcript: "Meditated for an hour and fifteen minutes on the retreat.", expect: { activities: [{ id: "meditate", quantity: 75 }] } },
  { id: "hard-chess-games", source: "written", transcript: "Played three games of chess, around 40 minutes in total.", expect: { activities: [{ id: "chess", quantity: 40 }] } },
  { id: "hard-not-guitar", source: "written", transcript: "Listened to a lot of guitar music while running 5 km.", expect: { activities: [{ id: "running", quantity: 5 }] } },
  { id: "hard-past-negation", source: "written", transcript: "I wanted to run today but I skipped it, did 20 minutes of yoga instead.", expect: { activities: [{ id: "yoga", quantity: 20 }] } },
  { id: "hard-pt-gym-yesterday", source: "written", transcript: "Ontem fui ao ginásio, treino de pernas, e hoje meditei 20 minutos.", expect: { activities: [{ id: "gym", quantity: 1, date: YESTERDAY }, { id: "meditate", quantity: 20 }] } },
  { id: "hard-semi-marathon-pt", source: "written", transcript: "Hoje fiz a meia maratona de Lisboa!", expect: { activities: [{ id: "running", quantity: 21 }] } },

  // Spoken corrections of a draft (the mic on the review screen).
  {
    id: "fix-estimate-by-voice",
    source: "written",
    transcript: "Reading was actually 25 pages.",
    refinement: {
      originalTranscript: "Long half an hour of reading.",
      currentDraft: {
        activities: [{ activityId: "reading", quantity: 21, date: "2026-11-12", time: null, description: null, estimatedFrom: "half an hour", confidence: 0.5 }],
        metrics: [],
        note: { title: "Reading", text: "Half an hour of reading.", date: "2026-11-12", confidence: 0.8 },
        unresolved: [],
      },
    },
    expect: { activities: [{ id: "reading", quantity: 25, estimated: false }] },
  },
  {
    id: "fix-amount-short",
    source: "written",
    transcript: "No, eight kilometers.",
    refinement: {
      originalTranscript: "Ran 6 km this morning.",
      currentDraft: {
        activities: [{ activityId: "running", quantity: 6, date: "2026-11-12", time: null, description: null, confidence: 0.9 }],
        metrics: [],
        note: { title: "Run", text: "Morning run.", date: "2026-11-12", confidence: 0.8 },
        unresolved: [],
      },
    },
    expect: { activities: [{ id: "running", quantity: 8 }] },
  },
  {
    id: "fix-keeps-others",
    source: "written",
    transcript: "Change the run to ten kilometers.",
    refinement: {
      originalTranscript: "Ran 9 km and went to the gym.",
      currentDraft: {
        activities: [
          { activityId: "running", quantity: 9, date: "2026-11-12", time: null, description: null, confidence: 0.9 },
          { activityId: "gym", quantity: 1, date: "2026-11-12", time: null, description: null, confidence: 0.9 },
        ],
        metrics: [],
        note: { title: "Training", text: "Run and gym.", date: "2026-11-12", confidence: 0.8 },
        unresolved: [],
      },
    },
    expect: { activities: [{ id: "running", quantity: 10 }, { id: "gym", quantity: 1 }] },
  },

  // Another person's catalog.
  { id: "other-run", source: "written", transcript: "Went running, 4k.", activities: otherActivities, metrics: [], expect: { activities: [{ id: "run", quantity: 4 }] } },
  { id: "other-mixed", source: "written", transcript: "Did 50 push-ups, a strength workout and drank three glasses of water.", activities: otherActivities, metrics: [], expect: { activities: [{ id: "pushups", quantity: 50 }, { id: "strength", quantity: 1 }, { id: "water", quantity: 3 }] } },
  { id: "other-walk-hours", source: "written", transcript: "Walked for an hour and ten minutes.", activities: otherActivities, metrics: [], expect: { activities: [{ id: "walk", quantity: 70 }] } },
];
