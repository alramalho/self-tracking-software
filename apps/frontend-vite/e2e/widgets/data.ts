// Display fixtures only. This entry point is never linked from the production app.
import type { PlanCardProps } from "../../src/components/home-cards/types";
export const today = new Date().toISOString();
export const metrics = [
  { id: "energy", title: "Energy", emoji: "⚡" },
  { id: "mood", title: "Mood", emoji: "😊" },
];
export const entries = [
  { metricId: "energy", createdAt: today, rating: 4, skipped: false },
];
export const plan = {
  id: "fitness",
  goal: "Exercise regularly",
  emoji: "🏃",
  activities: [{ id: "run", title: "Running", emoji: "🏃", measure: "km" }],
  outlineType: "TIMES_PER_WEEK",
  timesPerWeek: 3,
  sessions: [],
  finishingDate: null,
  isPaused: false,
  progress: {
    weeks: [],
    achievement: { streak: 4 },
    habitAchievement: { progressValue: 4 },
    lifestyleAchievement: { progressValue: 4 },
  },
} as unknown as PlanCardProps["plan"];
export const scheduled = {
  ...plan,
  id: "reading",
  goal: "Read every day",
  emoji: "📖",
  outlineType: "SPECIFIC",
  activities: [{ id: "read", title: "Reading", emoji: "📚", measure: "pages" }],
  sessions: [
    { id: "slot", activityId: "read", date: new Date(), quantity: 10 },
  ],
} as unknown as PlanCardProps["plan"];
