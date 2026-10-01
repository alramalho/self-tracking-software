import type { DesignSession, SessionTargets } from "@tsw/prisma/follow-through";

// Scripts a model can leak into text by accident. Allowed only when the person's own words use them.
const SCRIPTS: [string, RegExp][] = [
  ["Cyrillic", /\p{Script=Cyrillic}/u],
  ["Arabic", /\p{Script=Arabic}/u],
  ["Hebrew", /\p{Script=Hebrew}/u],
  ["Devanagari", /\p{Script=Devanagari}/u],
  ["Thai", /\p{Script=Thai}/u],
  ["Hangul", /\p{Script=Hangul}/u],
  ["Han", /\p{Script=Han}/u],
  ["Hiragana", /\p{Script=Hiragana}/u],
  ["Katakana", /\p{Script=Katakana}/u],
];

/** Writing systems that appear in the output but nowhere in what the person wrote. Empty means clean. */
export function strayScripts(output: string, personText: string) {
  return SCRIPTS.filter(([, re]) => re.test(output) && !re.test(personText)).map(([name]) => name);
}
import { addDays, daysBetween } from "./dates";

export interface ValidatableSession {
  date: string;
  activity: string;
  quantity: number;
  targets: SessionTargets;
}
export interface ValidationContext {
  /** Everything the person wrote (goal, baseline, answers). Used to spot characters the model leaked in by accident. */
  personText?: string;
  activities: { key: string; measure: string }[];
  /** YYYY-MM-DD, first day of the window. */
  windowStart: string;
  /** Each week's distinct training days must fall inside this range. */
  daysMin: number;
  daysMax: number;
  /** Easy-pace bounds, in seconds per km, extracted from the person's own baseline. */
  easyPace: { fast: number; slow: number } | null;
  /** What the person does now in a week, in the activity's unit (from their own words). Week 1 never drops below it. */
  baselineWeekly?: number | null;
  /** Their usual single session, same unit. Sessions don't shrink far below it just because there are more days. */
  baselineSession?: number | null;
  /** The heaviest working load they lift now. Each week's heaviest set stays at or above it. */
  baselineLoadKg?: number | null;
  /** Number of complete weeks that must be present (2 for onboarding, 2 for a rolling window). */
  weeks: number;
}

const isRunning = (measure: string) => /^(km|kilomet|mile)/i.test(measure);

/** Reasons the output cannot be shown to a person. Empty means it can. */
export function validateSessions(
  sessions: ValidatableSession[],
  ctx: ValidationContext,
): string[] {
  const problems: string[] = [];
  const stray = strayScripts(JSON.stringify(sessions.map((x) => [(x as unknown as DesignSession).title, (x as unknown as DesignSession).descriptiveGuide, x.targets])), ctx.personText ?? "");
  if (stray.length) problems.push(`text contains ${stray.join(", ")} characters the person did not use`);
  const end = addDays(ctx.windowStart, ctx.weeks * 7);
  const byDay = new Map<string, ValidatableSession[]>();
  for (const s of sessions) {
    const offset = daysBetween(ctx.windowStart, s.date);
    if (offset < 0 || s.date >= end) problems.push(`${s.date} is outside the ${ctx.weeks * 7}-day window`);
    const activity = ctx.activities.find((a) => a.key === s.activity);
    if (!activity) problems.push(`unknown activity "${s.activity}"`);
    byDay.set(s.date, [...(byDay.get(s.date) ?? []), s]);
    const t = s.targets;
    const measure = activity?.measure ?? "";
    if (t.sets && t.reps && /^reps?$/i.test(measure) && s.quantity !== t.sets * t.reps)
      problems.push(`${s.date}: quantity ${s.quantity} is not sets × reps (${t.sets}×${t.reps})`);
    const pace = t.pace;
    if (isRunning(measure)) {
      if (!pace) problems.push(`${s.date}: running session has no pace object (use basis UNKNOWN)`);
      else if (pace.basis === "UNKNOWN") {
        if (pace.minSecondsPerKm !== null || pace.maxSecondsPerKm !== null)
          problems.push(`${s.date}: pace numbers given with basis UNKNOWN`);
      } else {
        if (pace.minSecondsPerKm === null || pace.maxSecondsPerKm === null || pace.minSecondsPerKm > pace.maxSecondsPerKm)
          problems.push(`${s.date}: pace range is missing or inverted`);
        if (!pace.evidence) problems.push(`${s.date}: pace has no evidence`);
        if (pace.basis === "USER_REPORTED_EASY_PACE") {
          if (!ctx.easyPace) problems.push(`${s.date}: USER_REPORTED_EASY_PACE but the baseline has no pace`);
          else if (
            (pace.minSecondsPerKm ?? 0) < ctx.easyPace.fast - 15 ||
            (pace.maxSecondsPerKm ?? 0) > ctx.easyPace.slow + 30
          )
            problems.push(`${s.date}: easy pace drifts outside the reported ${ctx.easyPace.fast}–${ctx.easyPace.slow} s/km`);
        }
        if (pace.minSecondsPerKm && (s.quantity * pace.minSecondsPerKm) / 60 > t.durationMinutes + 1)
          problems.push(`${s.date}: ${s.quantity} km at that pace does not fit ${t.durationMinutes} min`);
      }
    }
  }
  for (const [day, list] of byDay) if (list.length > 2) problems.push(`${day}: more than two entries`);
  for (let w = 0; w < ctx.weeks; w++) {
    const from = addDays(ctx.windowStart, w * 7);
    const to = addDays(ctx.windowStart, w * 7 + 7);
    const days = new Set(sessions.filter((s) => s.date >= from && s.date < to).map((s) => s.date));
    const total = weekTotal(sessions, from, to);
    // A coach builds from what you already do. Allow 10% for rounding to whole units.
    if (w === 0 && ctx.baselineWeekly && total < ctx.baselineWeekly * 0.9)
      problems.push(`week 1 totals ${total}, less than the ${ctx.baselineWeekly} the person already does each week`);
    // Nor a jump: at most 25% more. When the coach added days (say 1 run a week becomes 3), allow the
    // shorter sessions those days need: about 60% of a usual session each.
    const ceiling = ctx.baselineWeekly
      ? Math.max(ctx.baselineWeekly * 1.25, ctx.daysMin * 0.6 * (ctx.baselineSession ?? 0))
      : null;
    if (w === 0 && ceiling && total > Math.ceil(ceiling))
      problems.push(`week 1 totals ${total}, a jump from the ${ctx.baselineWeekly} the person does now (keep it at or under ${Math.ceil(ceiling)})`);
    // Whole units are too coarse to judge "half a session" when a usual session is 3 km or less.
    if (ctx.baselineSession && ctx.baselineSession > 3) {
      const tiny = sessions.filter((x) => x.date >= from && x.date < to && x.quantity < ctx.baselineSession! * 0.5).length;
      if (tiny > 1)
        problems.push(`week ${w + 1} has ${tiny} sessions under half the person's usual ${ctx.baselineSession}; at most one short easy session a week`);
    }
    const heaviest = Math.max(0, ...sessions.filter((x) => x.date >= from && x.date < to).map((x) => x.targets.loadKg ?? 0));
    if (ctx.baselineLoadKg && heaviest > 0 && heaviest < ctx.baselineLoadKg * 0.95)
      problems.push(`week ${w + 1}'s heaviest set is ${heaviest} kg, below the ${ctx.baselineLoadKg} kg the person already lifts`);
    if (days.size < ctx.daysMin || days.size > ctx.daysMax)
      problems.push(`week ${w + 1} has ${days.size} training days, expected ${ctx.daysMin === ctx.daysMax ? ctx.daysMin : `${ctx.daysMin}-${ctx.daysMax}`}`);
  }
  return problems;
}

/** Fastest and slowest easy pace from the extracted baseline numbers, if the person gave any. */
export function easyPaceFrom(
  measurements: { metric: string; value: number; unit: string }[],
): ValidationContext["easyPace"] {
  const values = measurements
    .filter((m) => /^easy_pace/i.test(m.metric) && /s\/km|sec/i.test(m.unit))
    .map((m) => m.value);
  return values.length ? { fast: Math.min(...values), slow: Math.max(...values) } : null;
}

export type { DesignSession };

/** Sum of session quantities between two days (one activity per plan, so one unit). */
export function weekTotal(sessions: { date: string; quantity: number }[], from: string, to: string) {
  return sessions.filter((x) => x.date >= from && x.date < to).reduce((n, x) => n + x.quantity, 0);
}

type Measurement = { metric: string; value: number; unit: string };
/** "current_weekly_volume" from the baseline, if the person's words allowed it. */
export const weeklyVolumeFrom = (m: Measurement[]) => m.find((x) => /^current_weekly_volume$/i.test(x.metric))?.value ?? null;
/** "current_top_load" in kg, if they gave one. */
/** "current_session": their usual single session, same unit. */
export const sessionSizeFrom = (m: Measurement[]) => m.find((x) => /^current_session$/i.test(x.metric))?.value ?? null;
export const topLoadFrom = (m: Measurement[]) => m.find((x) => /^current_top_load$/i.test(x.metric) && /kg/i.test(x.unit))?.value ?? null;

export interface LoggedResult {
  date: string;
  quantity: number;
  difficulty: string | null;
}

/**
 * How much the next two weeks may ask, from what the person actually did (one activity, one unit).
 * Coaching rules, not model judgement:
 * - after a missed week (illness, life): restart at no more than 75% of the last week they trained,
 *   and don't go past that pre-break week until a full week is back;
 * - after a session logged hard: the next week stays at or under 90% of the week just done;
 * - otherwise: grow at most about 10% a week.
 * Rounded up to whole units, so a 13 km week may become 10, 12 or 14 rather than 9.75 or 14.3.
 */
export function loadChangeProblems(
  results: LoggedResult[],
  sessions: { date: string; quantity: number }[],
  windowStart: string,
): string[] {
  const total = (from: string, to: string) =>
    results.filter((r) => r.date >= from && r.date < to).reduce((n, r) => n + r.quantity, 0);
  const lastWeek = total(addDays(windowStart, -7), windowStart);
  const a = weekTotal(sessions, windowStart, addDays(windowStart, 7));
  const b = weekTotal(sessions, addDays(windowStart, 7), addDays(windowStart, 14));
  const problems: string[] = [];
  if (lastWeek === 0) {
    // The most recent week they trained, within the last month.
    const before = [14, 21, 28].map((d) => total(addDays(windowStart, -d), addDays(windowStart, -d + 7))).find((t) => t > 0);
    if (!before) return problems;
    const restart = Math.ceil(before * 0.75);
    if (a > restart) problems.push(`after a missed week, the first week should restart at ${restart} or less (75% of the ${before} they last did); it totals ${a}`);
    if (b > before) problems.push(`week 2 totals ${b}; don't go past the ${before} they did before the break yet`);
    return problems;
  }
  const hard = results.some((r) => r.date >= addDays(windowStart, -7) && r.date < windowStart && /hard/i.test(r.difficulty ?? ""));
  const capA = Math.ceil(lastWeek * (hard ? 0.9 : 1.1));
  if (a > capA)
    problems.push(hard
      ? `after a hard session, the first week should be ${capA} or less (90% of the ${lastWeek} just done); it totals ${a}`
      : `the first week totals ${a}; grow at most about 10% from the ${lastWeek} just done (${capA} or less)`);
  const capB = Math.ceil(a * 1.1);
  if (b > capB) problems.push(`week 2 totals ${b}; grow at most about 10% from week 1 (${capB} or less)`);
  return problems;
}
