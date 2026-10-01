import type { RouteId } from "@tsw/prisma/follow-through";

export interface DayRange {
  min: number;
  max: number;
}

/**
 * The days a person prefers are an anchor, not an order (the coach can adjust them or push back).
 * When the coach agrees, the two routes bracket the preference, Garmin-style: Helly "up to" it,
 * Oli "at or above" it. Preference 3 gives Helly 2–3 and Oli 3–4.
 */
export function defaultRanges(preferred: number): Record<RouteId, DayRange> {
  const p = Math.max(1, Math.min(7, Math.round(preferred)));
  return {
    steady: { min: Math.max(1, p - 1), max: p },
    focused: { min: p, max: Math.min(7, p + 1) },
  };
}

/** The coach may move the ranges, within limits that keep the two routes coherent. */
export function sanitizeRanges(ranges: Record<RouteId, DayRange>): Record<RouteId, DayRange> {
  const clamp = (n: number) => Math.max(1, Math.min(7, Math.round(n)));
  const fix = (r: DayRange): DayRange => {
    const min = clamp(Math.min(r.min, r.max));
    return { min, max: Math.min(clamp(Math.max(r.min, r.max)), min + 2) };
  };
  const steady = fix(ranges.steady);
  const focused = fix(ranges.focused);
  // Oli never asks for fewer days than Helly.
  return {
    steady,
    focused: { min: Math.max(focused.min, steady.min), max: Math.max(focused.max, steady.max) },
  };
}

export const sameRanges = (a: Record<RouteId, DayRange>, b: Record<RouteId, DayRange>) =>
  a.steady.min === b.steady.min && a.steady.max === b.steady.max && a.focused.min === b.focused.min && a.focused.max === b.focused.max;

export const rangeLabel = (r: DayRange) => (r.min === r.max ? `${r.min}` : `${r.min}–${r.max}`);

export const routeCoach = { steady: "Helly", focused: "Oli" } as const;
