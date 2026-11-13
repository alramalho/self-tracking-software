/**
 * Hour-by-hour simulation of one person's weeks with the coach, through the real decision code:
 * - `decideMonitoring` (monitoring/model.ts): every proactive message and push,
 * - `planAlert` (follow-through/coach-inbox.ts): the "at risk / gone quiet" drawer on the home card and Coach tab,
 * - `settleTurn` + the effects of `finish` (coach/talk/service.ts): what answering the drawer quiets and books,
 * - the reminder pushes of `sendDueReminders` (check-ins on a named day, the morning after a trip).
 *
 * The database writes of the real services are replaced by the same state changes in memory, so a week costs
 * nothing to simulate. Talk turns come from a script (deterministic) or from the real model (`--live`).
 */
import { addDays, format, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { planAlert, type CoachPlan } from "@tsw/prisma/follow-through/coach-inbox";
import type { CoachMonitoringState, PlanSupport } from "@tsw/prisma/follow-through";
import { decideMonitoring, monitoringState } from "../../src/services/coach/monitoring/model";
import type { MonitoringInput, MonitoringMessage } from "../../src/services/coach/monitoring/types";
import { settleTurn } from "../../src/services/coach/talk/service";
import { talkRequestSchema } from "../../src/services/coach/talk/schema";
import type { CoachTurn, TalkTurn } from "../../src/services/coach/talk/types";

export const TZ = "UTC";
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export type Reason = "busy" | "sick" | "travel" | "motivation" | "other" | "talk";

/** What the person does in the app on a given day of the journey (0 = the first Sunday). */
export type JourneyEvent =
  | { day: number; at: string; log: true; difficulty?: "hard" | "very_hard"; note?: string }
  /** Opens the app at that time; if the drawer is up, answers it with these words, one per coach question. */
  | { day: number; at: string; answerAlert: { reason: Reason; answers: string[]; notSure?: boolean } }
  /** Writes to the coach in chat (answers any open outreach). */
  | { day: number; at: string; writes: string };

export interface Journey {
  id: string;
  title: string;
  /** Why this matters for an accountability app, in one line. */
  why: string;
  source: "real" | "common";
  days: number;
  plan: { goal: string; timesPerWeek: number; createdDaysBefore: number; coached: boolean };
  /** Logs before day 0, as days before day 0 (1 = Saturday before). */
  pastLogs: number[];
  /** Earlier messages with the coach (before day 0), oldest first. */
  pastMessages?: { daysBefore: number; from: "USER" | "COACH"; text: string }[];
  events: JourneyEvent[];
  expect: JourneyExpectation;
}

export interface JourneyExpectation {
  /** Most pushes allowed over the journey, besides the weekly review (at most one a week, always checked). */
  maxPushes: number;
  /** Pushes that must happen: kind on a day (optionally hour range). */
  pushes?: { kind: string; day: number; fromHour?: number; toHour?: number }[];
  /** Kinds that must never be sent. */
  noPushKinds?: string[];
  /** Days the drawer must be up at 19:00, and days it must not. */
  alertOn?: number[];
  alertOff?: number[];
  /** Silent nudges allowed (shown in the app, no push). */
  maxNudges?: number;
  /** For the live layer: what each talk must and must not do, in order of the talks. */
  talks?: TalkExpectation[];
  /** For the live layer: generated proactive messages (review opener, nudge, lapse, difficulty). */
  messages?: MessageExpectation[];
}

export interface TalkExpectation {
  /** The first coach screen: may it ask a question? */
  firstAsks: "must" | "may" | "never";
  /** Things the coach must not ask (it was already told). */
  neverAsks?: RegExp[];
  /** Things the coach should refer to (history or the answer). */
  mentions?: RegExp[];
  /** How the conversation must end. */
  ends?: "committed" | "away" | "not_sure" | "answered";
}

export interface MessageExpectation {
  kind: string;
  mentions?: RegExp[];
  never?: RegExp[];
}

export interface Touch {
  at: string;
  day: number;
  kind: string;
  push: boolean;
  /** Text shown, when known (scripted or generated). */
  text?: string;
}

export interface TalkRecord {
  day: number;
  reason: Reason;
  turns: { said: string; shown: TalkTurn }[];
  ended: string;
}

export interface SimResult {
  touches: Touch[];
  alertDays: number[];
  talks: TalkRecord[];
  /** Proactive messages that need generated text in the live layer. */
  generated: { day: number; kind: string; decision: unknown; history: { role: string; content: string }[] }[];
}

/** Coach screens for the deterministic layer, one per answer; the live layer replaces this. */
export type TalkModel = (input: {
  journey: Journey;
  reason: Reason;
  turns: { question: string; answer: string }[];
  notSure: boolean;
  today: string;
  weekday: string;
  history: { day: string; from: "them" | "you"; text: string }[];
}) => Promise<CoachTurn>;

/** A stand-in coach: one question when the reason needs one, then end; a named day is a commitment. */
export const scriptedTalk: TalkModel = async ({ reason, turns, notSure, today }) => {
  const answer = turns.at(-1)?.answer ?? "";
  const named = /\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.exec(answer);
  if (notSure) return turn({ say: "Okay.", action: "ask_again" });
  if (reason === "travel" && /back/i.test(answer) && named?.[1].toLowerCase() === "today") return turn({ say: "Welcome back. I'll be looking for your next log." });
  if (named && /back/i.test(answer) && reason === "travel")
    return turn({ say: "Safe travels.", action: "quiet", until: dayNamed(named[1], today) });
  if (named) return turn({ say: "Counting on you.", action: "commit", until: dayNamed(named[1], today) });
  if (!turns.length && (reason === "travel" || reason === "motivation"))
    return turn({ say: reason === "travel" ? "When are you back?" : "What's the smallest session you'd do, and when?", ask: "text" });
  return turn({ say: "Got it. I'll be looking for your next log." });
};

const turn = (over: Partial<CoachTurn>): CoachTurn => ({
  say: "",
  detail: "",
  ask: "none",
  placeholder: "",
  action: "none",
  until: "",
  checkAt: "",
  ...over,
});

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
function dayNamed(word: string, today: string) {
  const t = parseISO(today);
  const w = word.toLowerCase();
  if (w === "today") return today;
  if (w === "tomorrow") return format(addDays(t, 1), "yyyy-MM-dd");
  const diff = (WEEKDAYS.indexOf(w) - t.getUTCDay() + 7) % 7 || 7;
  return format(addDays(t, diff), "yyyy-MM-dd");
}

// Day 0 is a Sunday at 00:00 UTC.
export const START = new Date("2026-11-01T00:00:00Z");
const at = (day: number, hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(START.getTime() + day * DAY + h * HOUR + m * 60_000);
};
const dayOf = (d: Date) => Math.floor((d.getTime() - START.getTime()) / DAY);
const ymd = (d: Date) => formatInTimeZone(d, TZ, "yyyy-MM-dd");

function support(journey: Journey): PlanSupport {
  return {
    planId: "plan",
    mode: "WEEKLY",
    weekdays: [],
    time: null,
    timezone: TZ,
    durationMinutes: 45,
    format: "LOG",
    resourceUrl: null,
    resourceName: null,
    nextStep: "",
    effectiveDate: "2026-10-01",
    coaching: journey.plan.coached
      ? { role: "consistency", followUps: true, dataAccess: { workouts: false, sleep: false } }
      : { role: "tracking", followUps: false, dataAccess: { workouts: false, sleep: false } },
    preferences: {
      coaching: journey.plan.coached,
      weeklyReview: journey.plan.coached,
      reviewDay: 0,
      reviewTime: "18:00",
      checkIn: false,
      dayReminderTime: "09:00",
    },
  } as unknown as PlanSupport;
}

export async function simulate(journey: Journey, talkModel: TalkModel = scriptedTalk): Promise<SimResult> {
  const createdAt = new Date(START.getTime() - journey.plan.createdDaysBefore * DAY);
  const entries: MonitoringInput["entries"] = journey.pastLogs.map((d, i) => {
    const datetime = new Date(START.getTime() - d * DAY + 8 * HOUR);
    return { id: `past-${i}`, activityId: "act", datetime, updatedAt: datetime, difficulty: null, privateNotes: null, source: "app" };
  });
  const messages: (MonitoringMessage & { content: string })[] = (journey.pastMessages ?? []).map((m, i) => ({
    id: `past-msg-${i}`,
    role: m.from,
    planId: "plan",
    createdAt: new Date(START.getTime() - m.daysBefore * DAY + 17 * HOUR + i * 60_000),
    metadata: { source: "talk_to_coach" },
    content: m.text,
  }));
  const state: CoachMonitoringState = monitoringState();
  const supports = { plan: support(journey) };
  const touches: Touch[] = [];
  const alertDays: number[] = [];
  const talks: TalkRecord[] = [];
  const generated: SimResult["generated"] = [];
  const plan = { id: "plan", goal: journey.plan.goal, timesPerWeek: journey.plan.timesPerWeek, createdAt, activityIds: ["act"] };

  const alertNow = (now: Date) => {
    const coachPlan: CoachPlan = {
      id: "plan",
      goal: plan.goal,
      outlineType: "TIMES_PER_WEEK",
      timesPerWeek: plan.timesPerWeek,
      createdAt,
      activities: [{ id: "act" }],
      progress: { achievement: { missedLastWeek: missedLastWeek(now) } },
    };
    return planAlert({
      plan: coachPlan,
      entries: entries.filter((e) => e.datetime <= now),
      state: { supports, monitoring: state } as never,
      now,
    });
  };
  // Last week fell short of the target: what the weekly progress job would record.
  const missedLastWeek = (now: Date) => {
    const weekStart = new Date(START.getTime() + Math.floor((now.getTime() - START.getTime()) / (7 * DAY)) * 7 * DAY);
    const prev = new Date(weekStart.getTime() - 7 * DAY);
    if (prev < createdAt) return null;
    const days = new Set(entries.filter((e) => e.datetime >= prev && e.datetime < weekStart).map((e) => ymd(e.datetime))).size;
    return days < plan.timesPerWeek ? ({ inARow: 1, streakBefore: 0, streakAfter: 0 } as never) : null;
  };

  const historyFor = (now: Date) =>
    messages
      .filter((m) => m.createdAt <= now && now.getTime() - m.createdAt.getTime() < 21 * DAY && m.content)
      .slice(-16)
      .map((m) => ({ day: formatInTimeZone(m.createdAt, TZ, "yyyy-MM-dd EEE"), from: (m.role === "USER" ? "them" : "you") as "them" | "you", text: m.content }));

  const addMessage = (role: "USER" | "COACH", content: string, now: Date, metadata: object) =>
    messages.push({ id: `m${messages.length}`, role, planId: "plan", createdAt: now, metadata, content });

  for (let t = START.getTime(); t < START.getTime() + journey.days * DAY; t += HOUR) {
    const hourStart = new Date(t);
    const hourEnd = new Date(t + HOUR);
    const day = dayOf(hourStart);

    // 1. What the person does this hour.
    for (const e of journey.events.filter((e) => at(e.day, e.at) >= hourStart && at(e.day, e.at) < hourEnd)) {
      const now = at(e.day, e.at);
      if ("log" in e) {
        entries.push({ id: `log-${entries.length}`, activityId: "act", datetime: now, updatedAt: now, difficulty: e.difficulty ?? null, privateNotes: e.note ?? null, source: "app" });
      } else if ("writes" in e) {
        addMessage("USER", e.writes, now, {});
      } else if ("answerAlert" in e) {
        const alert = alertNow(now);
        if (!alert) continue;
        const today = ymd(now);
        const record: TalkRecord = { day, reason: e.answerAlert.reason, turns: [], ended: "" };
        const asked: { question: string; answer: string }[] = [];
        for (let i = 0; i <= e.answerAlert.answers.length + 1; i++) {
          // "Not sure yet" is tapped on the coach's question after the scripted answers run out.
          const notSure = !!e.answerAlert.notSure && i === e.answerAlert.answers.length + 1;
          const request = talkRequestSchema.parse({ reason: e.answerAlert.reason, turns: asked.map((a) => ({ say: a.question, answer: a.answer })), notSure, missed: alert.status === "missed" });
          const out = await talkModel({ journey, reason: e.answerAlert.reason, turns: asked, notSure, today, weekday: formatInTimeZone(now, TZ, "EEEE"), history: historyFor(now) });
          const settled = settleTurn(out, request, today);
          const said = notSure ? "Not sure yet." : i === 0 ? reasonWords(e.answerAlert.reason) : (asked.at(-1)?.answer ?? "");
          if (said) addMessage("USER", said, now, { source: "talk_to_coach" });
          addMessage("COACH", [settled.shown.say, settled.shown.detail].filter(Boolean).join(" "), now, { source: "talk_to_coach" });
          record.turns.push({ said, shown: settled.shown });
          if (settled.over) {
            finishTalk(state, settled, today, now);
            record.ended = settled.quiet?.why ?? "none";
            break;
          }
          const answer = e.answerAlert.answers[i];
          if (answer === undefined && e.answerAlert.notSure && i === e.answerAlert.answers.length) continue;
          if (answer === undefined) {
            // The person closes the drawer without answering: nothing is settled.
            record.ended = "left";
            break;
          }
          asked.push({ question: settled.shown.say, answer });
        }
        talks.push(record);
      }
    }

    // 2. Check-in pushes booked by Talk to coach, skipped once they logged.
    for (const r of state.reminders ?? []) {
      if (r.sentAt || Date.parse(r.dueAt) >= hourEnd.getTime()) continue;
      r.sentAt = hourEnd.toISOString();
      const since = r.bookedAt ? Date.parse(r.bookedAt) : hourEnd.getTime() - 12 * HOUR;
      const done = entries.some((e) => e.datetime.getTime() >= since && e.datetime <= hourEnd);
      if (!done) touches.push({ at: hourEnd.toISOString(), day: dayOf(hourEnd), kind: `checkin:${r.kind ?? "remind"}`, push: true });
    }

    // 3. The hourly monitoring run (:07 past the hour).
    const now = new Date(t + 7 * 60_000);
    const input: MonitoringInput = {
      now,
      entitled: true,
      plans: [{ ...plan, isPaused: false, archivedAt: null, deletedAt: null, finishingDate: null }],
      supports,
      entries: entries.filter((e) => e.datetime <= now),
      messages: messages.filter((m) => m.createdAt <= now),
      sessions: [],
      state,
    };
    const decision = decideMonitoring(input);
    if (decision) {
      const push = decision.kind !== "nudge";
      touches.push({ at: now.toISOString(), day, kind: decision.kind, push });
      if (decision.kind !== "reminder" && decision.kind !== "session")
        generated.push({ day, kind: decision.kind, decision, history: messages.filter((m) => m.createdAt <= now).slice(-12).map((m) => ({ role: m.role, content: m.content })) });
      commitDecision(state, decision, now, messages);
    }

    // 4. Is the drawer up when they look at 19:00?
    if (hourStart.getUTCHours() === 19 && alertNow(new Date(t + 30 * 60_000))) alertDays.push(day);
  }
  return { touches, alertDays, talks, generated };
}

const reasonWords = (reason: Reason) =>
  ({ busy: "I was busy.", sick: "I was tired or sick.", travel: "I'm travelling.", motivation: "I lost motivation.", other: "", talk: "" })[reason];

/** What `finish` in talk/service.ts writes, without the database. */
function finishTalk(state: CoachMonitoringState, settled: ReturnType<typeof settleTurn>, today: string, now: Date) {
  if (settled.quiet) state.quiet = { ...state.quiet, plan: { ...settled.quiet, at: now.toISOString() } };
  for (const r of state.requests) if (r.kind === "nudge" && r.planIds.includes("plan") && !r.resolvedAt && !r.closedAt) r.resolvedAt = now.toISOString();
  const commitment = settled.shown.commitment;
  const awayUntil = settled.quiet?.why === "away" ? settled.quiet.until : null;
  const check = commitment?.checkAt
    ? { kind: "commitment" as const, at: new Date(`${commitment.day}T${commitment.checkAt}:00Z`) }
    : awayUntil
      ? { kind: "return" as const, at: new Date(`${format(addDays(parseISO(awayUntil), 1), "yyyy-MM-dd")}T09:00:00Z`) }
      : null;
  if (check) {
    state.reminders = (state.reminders ?? []).filter((r) => r.planId !== "plan" || r.sentAt);
    state.reminders.push({ planId: "plan", dueAt: check.at.toISOString(), kind: check.kind, bookedAt: now.toISOString() } as never);
  }
  void today;
}

/** What the monitoring commit writes when a message goes out (service.ts), without the database. */
function commitDecision(state: CoachMonitoringState, decision: ReturnType<typeof decideMonitoring> & object, now: Date, messages: (MonitoringMessage & { content: string })[]) {
  if (decision.kind === "reminder") {
    const r = state.requests.find((x) => x.id === decision.requestId);
    if (r) r.reminderAt = now.toISOString();
    state.lastOutreachAt = now.toISOString();
    return;
  }
  if (decision.kind === "review") for (const id of decision.planIds) state.reviewed[id] = ymd(now);
  if (decision.kind === "lapse") state.lapsePlanIds = state.lapsePlanIds?.filter((id) => !decision.planIds.includes(id));
  if (decision.entryId) state.consideredEntries[decision.entryId] = now.toISOString();
  const id = `msg-${decision.id}`;
  messages.push({ id, role: "COACH", planId: "plan", createdAt: now, metadata: { source: "plan_monitoring", coachRequestId: decision.id, requiresReply: true }, content: "" });
  state.requests.push({ id: decision.id, kind: decision.kind, planIds: decision.planIds, entryId: decision.entryId, sessionId: decision.sessionId, createdAt: now.toISOString(), requiresReply: true, chatId: "chat", messageId: id } as never);
  if (decision.kind === "nudge") return;
  state.lastOutreachAt = now.toISOString();
  if (decision.kind === "difficulty" || decision.kind === "session") state.lastExtraAt = now.toISOString();
}

export function checkJourney(journey: Journey, result: SimResult): string[] {
  const x = journey.expect;
  const problems: string[] = [];
  const reviews = result.touches.filter((t) => t.kind === "review");
  for (let week = 0; week * 7 < journey.days; week++)
    if (reviews.filter((r) => Math.floor(r.day / 7) === week).length > 1) problems.push(`more than one weekly review in week ${week + 1}`);
  const pushes = result.touches.filter((t) => t.push && t.kind !== "review");
  const nudges = result.touches.filter((t) => t.kind === "nudge");
  if (pushes.length > x.maxPushes) problems.push(`${pushes.length} pushes > ${x.maxPushes}: ${pushes.map((p) => `${p.kind}@d${p.day}`).join(", ")}`);
  for (const want of x.pushes ?? []) {
    const hit = [...pushes, ...reviews].some((p) => p.kind === want.kind && p.day === want.day && (want.fromHour === undefined || new Date(p.at).getUTCHours() >= want.fromHour) && (want.toHour === undefined || new Date(p.at).getUTCHours() <= want.toHour));
    if (!hit) problems.push(`missing push ${want.kind} on day ${want.day}`);
  }
  for (const kind of x.noPushKinds ?? []) if (pushes.some((p) => p.kind === kind)) problems.push(`unwanted ${kind} push`);
  if (x.maxNudges !== undefined && nudges.length > x.maxNudges) problems.push(`${nudges.length} nudges > ${x.maxNudges}`);
  for (const d of x.alertOn ?? []) if (!result.alertDays.includes(d)) problems.push(`drawer not up on day ${d}`);
  for (const d of x.alertOff ?? []) if (result.alertDays.includes(d)) problems.push(`drawer up on day ${d} (should be quiet)`);
  const ends = (x.talks ?? []).map((t) => t.ends);
  result.talks.forEach((talk, i) => {
    const want = ends[i];
    if (want && talk.ended !== want && !(want === "answered" && talk.ended === "answered")) problems.push(`talk ${i + 1} ended "${talk.ended}", expected "${want}"`);
  });
  if ((x.talks?.length ?? 0) > result.talks.length) problems.push(`${result.talks.length} talks happened, expected ${x.talks!.length}`);
  return problems;
}

export const weekdayName = (day: number) => format(addDays(parseISO("2026-11-01"), day), "EEE");
