import type { DesignSession, SessionTargets } from "@tsw/prisma/follow-through";

const DAY = 86_400_000;
const at = (day: string) => new Date(`${day}T12:00:00Z`);

export const addDay = (day: string, n: number) => new Date(at(day).getTime() + n * DAY).toISOString().slice(0, 10);
export const weekday = (day: string) => at(day).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
export const dayNumber = (day: string) => at(day).getUTCDate();
export const longDate = (day: string) => at(day).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
export const shortDate = (day: string) => at(day).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
export const weekRange = (from: string) => `${shortDate(from)} – ${shortDate(addDay(from, 6))}`;

export const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;

/** "7:00–7:24 /km", or null when no pace is known (never guessed). */
export function paceText(targets: SessionTargets) {
  const pace = targets.pace;
  if (!pace || pace.basis === "UNKNOWN" || pace.minSecondsPerKm === null || pace.maxSecondsPerKm === null) return null;
  return `${clock(pace.minSecondsPerKm)}–${clock(pace.maxSecondsPerKm)} /km`;
}

/** "3 × 5 · 62.5 kg · rest 2 min", or null for non-lifting sessions. */
export function liftText(targets: SessionTargets) {
  if (!targets.sets || !targets.reps) return null;
  const parts = [`${targets.sets} × ${targets.reps}`];
  if (targets.loadKg) parts.push(`${targets.loadKg} kg`);
  if (targets.restSeconds) parts.push(`rest ${Math.round(targets.restSeconds / 60 * 10) / 10} min`);
  return parts.join(" · ");
}

export const sessionsOn = (sessions: DesignSession[], day: string) => sessions.filter((s) => s.date === day);

export const unitLabel = (measure: string, quantity: number) =>
  /^km|kilomet/i.test(measure) ? "km" : /^min/i.test(measure) ? "min" : /^rep/i.test(measure) ? (quantity === 1 ? "rep" : "reps") : measure;
