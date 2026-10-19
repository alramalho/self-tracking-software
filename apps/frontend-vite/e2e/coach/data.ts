// Illustrative data for the Coach tab harness: four plans, one gone quiet with a coach nudge,
// two that missed last week, and a week of energy check-ins.
const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY);
const iso = (days: number) => ago(days).toISOString();
const dateKey = (days: number) => ago(days).toISOString().slice(0, 10) + "T00:00:00.000Z";

const activity = (id: string, title: string, emoji: string, measure: string) => ({
  id,
  title,
  emoji,
  measure,
  userId: "me",
  colorHex: "#3b82f6",
});
const run = activity("run", "Running", "🏃", "kilometers");
const guitar = activity("guitar", "Guitar", "🎸", "minutes");
const read = activity("read", "Reading", "📚", "pages");
const stretch = activity("stretch", "Stretching", "🧘", "minutes");
export const activities = [run, guitar, read, stretch];

const sunday = new Date();
sunday.setHours(0, 0, 0, 0);
sunday.setDate(sunday.getDate() - sunday.getDay());
const lastSunday = new Date(sunday.getTime() - 7 * DAY);

const plan = (id: string, goal: string, emoji: string, a: ReturnType<typeof activity>, order: number, extra: object = {}) => ({
  id,
  goal,
  emoji,
  userId: "me",
  activities: [a],
  sessions: [] as object[],
  milestones: [],
  outlineType: "TIMES_PER_WEEK",
  timesPerWeek: 3,
  createdAt: ago(40),
  finishingDate: null as Date | null,
  archivedAt: null,
  deletedAt: null,
  sortOrder: order,
  isPaused: false,
  visibility: "PUBLIC",
  backgroundImageUrl: null,
  progress: {
    weeks: [{ startDate: sunday, plannedActivities: 3, completedActivities: [] as object[] }],
    achievement: { streak: 2, missedLastWeek: null as object | null },
    habitAchievement: { isAchieved: false, progressValue: 2, maxValue: 4 },
    lifestyleAchievement: { isAchieved: false, progressValue: 2, maxValue: 9 },
  },
  ...extra,
});

const halfSessions = [1, 3, 5, 8, 10, 12].map((offset, i) => ({
  id: `s${i}`,
  activityId: "run",
  date: new Date(sunday.getTime() + offset * DAY + 12 * 3600_000),
  quantity: [5, 6, 5, 8, 6, 12][i],
  title: ["Easy run", "Tempo run", "Easy run", "Long run", "Intervals", "Long run"][i],
  descriptiveGuide: "Walk 5 minutes, then run at a pace where you could hold a conversation.",
  targets: {
    durationMinutes: [35, 40, 35, 60, 45, 80][i],
    effort: i % 2 ? "Comfortably hard" : "Easy, can talk in sentences",
    pace: { minSecondsPerKm: 420, maxSecondsPerKm: 444, basis: "USER_REPORTED_EASY_PACE", evidence: null },
    exercise: null,
    sets: null,
    reps: null,
    loadKg: null,
    restSeconds: null,
    progressMeasure: "Note how your legs feel the next morning",
  },
}));

export const plans = [
  plan("half", "Run my first half marathon", "🏃", run, 0, {
    outlineType: "SPECIFIC",
    sessions: halfSessions,
    finishingDate: ago(-70),
    progress: {
      weeks: [{ startDate: sunday, plannedActivities: halfSessions.slice(0, 3), completedActivities: [{ datetime: iso(1) }] }],
      achievement: { streak: 5, missedLastWeek: null },
      habitAchievement: { isAchieved: true, progressValue: 4, maxValue: 4 },
      lifestyleAchievement: { isAchieved: false, progressValue: 5, maxValue: 9 },
    },
  }),
  plan("guitar", "Practice guitar", "🎸", guitar, 1),
  plan("reading", "Read before bed", "📚", read, 2, {
    progress: {
      weeks: [{ startDate: lastSunday, plannedActivities: 3, completedActivities: [] }],
      achievement: { streak: 1, missedLastWeek: { streakBefore: 2, streakAfter: 1, inARow: 1, done: 1, target: 3 } },
      habitAchievement: { isAchieved: false, progressValue: 1, maxValue: 4 },
      lifestyleAchievement: { isAchieved: false, progressValue: 1, maxValue: 9 },
    },
  }),
  plan("stretch", "Stretch every morning", "🧘", stretch, 3, { timesPerWeek: 1 }),
];

const entry = (id: string, activityId: string, days: number) => ({
  id,
  activityId,
  userId: "me",
  datetime: ago(days),
  createdAt: ago(days),
  quantity: 5,
  deletedAt: null,
});
export const activityEntries = [
  entry("r1", "run", 1),
  entry("r2", "run", 9),
  entry("r3", "run", 16),
  entry("r4", "run", 20),
  entry("g1", "guitar", 7),
  entry("b1", "read", 2),
  entry("s1", "stretch", 1),
];

export const metrics = [
  { id: "energy", title: "Energy", emoji: "⚡", userId: "me" },
  { id: "mood", title: "Mood", emoji: "😊", userId: "me" },
];
export const metricEntries = Array.from({ length: 14 }, (_, i) => ({
  id: `m${i}`,
  metricId: "energy",
  rating: [4, 3, 4, 3, 2, 3, 3, 4, 4, 3, 4, 3, 4, 3][i],
  createdAt: dateKey(i + 1),
  skipped: false,
}));

const support = (planId: string, role: string) => ({
  planId,
  mode: "WEEKLY",
  weekdays: [],
  time: null,
  timezone: "Europe/Lisbon",
  durationMinutes: 20,
  format: "LOG",
  resourceUrl: null,
  resourceName: null,
  nextStep: "",
  effectiveDate: "2026-09-01",
  coaching: { role, followUps: true, dataAccess: { workouts: false, sleep: false } },
  preferences: {
    coaching: role !== "tracking",
    reminder: false,
    reminderMinutes: 30,
    dayReminderTime: "09:00",
    checkIn: false,
    checkInTime: "10:00",
    weeklyReview: true,
    reviewDay: 0,
    reviewTime: "18:00",
  },
});

export const followThrough = {
  canCoach: true,
  serverTime: new Date().toISOString(),
  state: {
    version: 1,
    enabled: true,
    pausedAt: null as string | null,
    supports: {
      half: support("half", "training"),
      guitar: support("guitar", "consistency"),
      reading: support("reading", "consistency"),
      stretch: support("stretch", "tracking"),
    } as Record<string, ReturnType<typeof support>>,
    sessions: {},
    checks: {},
    monitoring: {
      reviewed: {},
      pausedPlanIds: [] as string[],
      outreachPaused: false,
      requests: [
        { id: "nudge:guitar", planIds: ["guitar"], kind: "nudge", messageId: "nudge-guitar", chatId: "coach", createdAt: iso(0.1), requiresReply: true },
      ] as Record<string, unknown>[],
    },
  },
};
