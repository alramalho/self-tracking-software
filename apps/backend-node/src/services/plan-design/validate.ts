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
