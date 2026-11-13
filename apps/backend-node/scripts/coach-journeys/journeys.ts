/**
 * The coach's job in tracking.so is a tiny accountability nudge at the right moment, never a stream of
 * messages: one that is ignored teaches people to ignore the next. Each journey is one person over one to
 * two weeks, with what the coach should do (when it speaks, how often) and, for the live layer, what a good
 * message or question looks like. Day 0 is a Sunday; weeks run Sunday to Saturday; the weekly review is
 * Sunday 18:00. "real" journeys follow the owner's own history (Oct–Nov 2026); "common" ones are the other
 * situations every person meets.
 */
import type { Journey } from "./simulate";

const FOUR_A_WEEK = { goal: "train 4 times a week", timesPerWeek: 4, createdDaysBefore: 60, coached: true };

export const journeys: Journey[] = [
  {
    id: "owner-back-and-busy",
    title: "Back from travelling, busy with work, asked again two days later",
    why: "The owner's complaint (13 Nov): the same drawer every day after already saying why.",
    source: "real",
    days: 14,
    plan: FOUR_A_WEEK,
    pastLogs: [2, 5],
    pastMessages: [
      { daysBefore: 11, from: "USER", text: "I missed \"train 4 times a week\" last week. I was travelling." },
      { daysBefore: 4, from: "USER", text: "I missed \"train 4 times a week\" last week. I was travelling." },
      { daysBefore: 4, from: "COACH", text: "Travel explains last week. This week is still possible." },
    ],
    events: [
      { day: 1, at: "08:00", log: true },
      { day: 4, at: "20:00", answerAlert: { reason: "travel", answers: ["Just got back today, but I need to work.", "Saturday morning."] } },
      // Opens the app again the next two evenings: the drawer must not be there to answer.
      { day: 5, at: "20:00", answerAlert: { reason: "travel", answers: ["Still the same.", "Saturday."] } },
      { day: 6, at: "20:00", answerAlert: { reason: "travel", answers: ["Still the same.", "Saturday."] } },
      { day: 8, at: "07:30", log: true },
      { day: 11, at: "20:00", answerAlert: { reason: "busy", answers: ["Saturday."] } },
    ],
    expect: {
      maxPushes: 2,
      alertOn: [4, 11],
      // Answered on Thursday: quiet for the rest of that week and no "missed last week" for the week they
      // already explained. Sunday's "gone quiet" (six days without a log, a new week) is a fair new question.
      alertOff: [5, 6, 8, 9, 10, 12, 13],
      talks: [
        { firstAsks: "may", neverAsks: [/feel/i] },
        { firstAsks: "may", neverAsks: [/when (are|will) you (be )?back/i, /feel/i] },
      ],
    },
  },
  {
    id: "on-track",
    title: "Doing the plan: four logs a week",
    why: "Most weeks for an engaged person. The coach should barely exist: one weekly review at most.",
    source: "common",
    days: 14,
    plan: FOUR_A_WEEK,
    pastLogs: [1, 3, 5, 6],
    events: [1, 2, 4, 6, 8, 9, 11, 13].map((day) => ({ day, at: "07:30", log: true as const })),
    expect: {
      maxPushes: 2,
      pushes: [{ kind: "review", day: 7, fromHour: 18, toHour: 21 }],
      noPushKinds: ["lapse", "reminder", "nudge"],
      maxNudges: 0,
      alertOff: [1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13],
      messages: [{ kind: "review", never: [/\d+\s*(of|\/)\s*\d+/, /great job|amazing|crushing/i] }],
    },
  },
  {
    id: "gone-quiet",
    title: "Stops logging for a week, ignores the app",
    why: "The core accountability moment: one honest, silent nudge, then at most one push. Never a stream.",
    source: "common",
    days: 14,
    plan: { goal: "run 3 times a week", timesPerWeek: 3, createdDaysBefore: 40, coached: true },
    pastLogs: [1, 3, 6],
    events: [],
    expect: {
      // The silent nudge is in the app; at most the weekly review and one reminder push in two weeks.
      maxPushes: 2,
      maxNudges: 1,
      alertOn: [4],
      messages: [{ kind: "nudge", never: [/why did you|what happened/i] }],
    },
  },
  {
    id: "travel-with-return",
    title: "Travelling, says when they're back",
    why: "Nothing to nudge until they're home; then one check-in the morning after, only if they didn't log.",
    source: "real",
    days: 10,
    plan: FOUR_A_WEEK,
    pastLogs: [1, 2, 4, 6],
    events: [
      { day: 1, at: "08:00", log: true },
      { day: 4, at: "20:00", answerAlert: { reason: "travel", answers: ["I'm back on Saturday.", "Sunday morning."] } },
    ],
    expect: {
      maxPushes: 2,
      pushes: [{ kind: "checkin:return", day: 7, fromHour: 9, toHour: 10 }],
      // Quiet while away, and two more days after the return check-in.
      alertOff: [5, 6, 7, 8],
      maxNudges: 1,
      talks: [{ firstAsks: "must", mentions: [/back|when/i], ends: "away" }],
    },
  },
  {
    id: "travel-back-logged",
    title: "Back from the trip and logs before the check-in",
    why: "A check-in after they already trained is noise.",
    source: "common",
    days: 10,
    plan: FOUR_A_WEEK,
    pastLogs: [1, 2, 4, 6],
    events: [
      { day: 1, at: "08:00", log: true },
      { day: 4, at: "20:00", answerAlert: { reason: "travel", answers: ["I'm back on Saturday.", "Sunday morning."] } },
      { day: 7, at: "07:00", log: true },
    ],
    expect: { maxPushes: 0, noPushKinds: ["checkin:return"], alertOff: [5, 6, 7, 8] },
  },
  {
    id: "lost-motivation-commits",
    title: "Lost motivation, names a day, does not show up",
    why: "The single most useful question: when is the next session. Then one check-in on that day.",
    source: "real",
    days: 7,
    plan: FOUR_A_WEEK,
    pastLogs: [2, 5],
    events: [
      { day: 1, at: "08:00", log: true },
      { day: 4, at: "20:00", answerAlert: { reason: "motivation", answers: ["Maybe a short run tomorrow morning.", "Tomorrow morning."] } },
    ],
    expect: {
      maxPushes: 1,
      pushes: [{ kind: "checkin:commitment", day: 5, fromHour: 11, toHour: 22 }],
      alertOff: [5],
      talks: [{ firstAsks: "must", mentions: [/smallest|short|when|next/i], ends: "committed" }],
    },
  },
  {
    id: "lost-motivation-shows-up",
    title: "Lost motivation, names a day, logs it",
    why: "When they keep their word, the coach stays out of the way.",
    source: "common",
    days: 7,
    plan: FOUR_A_WEEK,
    pastLogs: [2, 5],
    events: [
      { day: 1, at: "08:00", log: true },
      { day: 4, at: "20:00", answerAlert: { reason: "motivation", answers: ["Tomorrow morning, a short run.", "Tomorrow morning."] } },
      { day: 5, at: "08:00", log: true },
    ],
    expect: { maxPushes: 0, noPushKinds: ["checkin:commitment"] },
  },
  {
    id: "sick",
    title: "Tired or sick",
    why: "No questions to someone who is ill: one human line, and quiet for the week.",
    source: "common",
    days: 7,
    plan: FOUR_A_WEEK,
    pastLogs: [1, 3, 5, 6],
    events: [
      { day: 1, at: "08:00", log: true },
      { day: 4, at: "20:00", answerAlert: { reason: "sick", answers: [] } },
    ],
    expect: { maxPushes: 0, alertOff: [5, 6], talks: [{ firstAsks: "never", neverAsks: [/\?/], ends: "answered" }] },
  },
  {
    id: "not-sure",
    title: "Not sure yet when they can train",
    why: "Ask again once, a few days later, not every day.",
    source: "common",
    days: 7,
    plan: FOUR_A_WEEK,
    pastLogs: [1, 3, 5, 6],
    events: [
      { day: 1, at: "08:00", log: true },
      { day: 4, at: "20:00", answerAlert: { reason: "travel", answers: [], notSure: true } },
    ],
    expect: { maxPushes: 0, alertOff: [5, 6], talks: [{ firstAsks: "may", ends: "not_sure" }] },
  },
  {
    id: "hard-session",
    title: "Logs a very hard session with a note",
    why: "A real signal worth one short check: the person told the app something went wrong.",
    source: "common",
    days: 4,
    plan: FOUR_A_WEEK,
    pastLogs: [1, 3, 5, 6],
    events: [{ day: 1, at: "08:00", log: true, difficulty: "very_hard", note: "Knee hurt on the last set, stopped early." }],
    expect: {
      maxPushes: 1,
      messages: [{ kind: "difficulty", mentions: [/knee/i] }],
    },
  },
  {
    id: "tracking-only",
    title: "Coaching off: just tracking",
    why: "They said no coach. No pushes and no questions, whatever happens.",
    source: "common",
    days: 14,
    plan: { goal: "read 5 times a week", timesPerWeek: 5, createdDaysBefore: 30, coached: false },
    pastLogs: [1],
    events: [],
    expect: { maxPushes: 0, maxNudges: 0 },
  },
];
