import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import type { CheckInClock } from "./types";

/** A commitment for today gets checked a few hours later, never after this hour. */
const LATEST_TODAY = "21:00";
const HOURS_LATER = 3;
/** Today's check-in lands on the next half hour, so the coach can say a round time. */
const ROUND_MINUTES = 30;
/** Closer than this to now, there's no point checking today. */
const MIN_MINUTES_AHEAD = 45;

/**
 * When the coach checks whether a committed session happened: on the day itself a few hours from now
 * (by 21:00), on a later day that morning at the plan's reminder time. Null when today is too late.
 */
export function checkInAt(day: string, now: Date, clock: CheckInClock): Date | null {
  const today = formatInTimeZone(now, clock.timezone, "yyyy-MM-dd");
  if (day > today) return fromZonedTime(`${day}T${clock.morning}:00`, clock.timezone);
  const latest = fromZonedTime(`${today}T${LATEST_TODAY}:00`, clock.timezone);
  const step = ROUND_MINUTES * 60000;
  const later = Math.ceil((now.getTime() + HOURS_LATER * 3600000) / step) * step;
  const at = new Date(Math.min(later, latest.getTime()));
  return at.getTime() - now.getTime() >= MIN_MINUTES_AHEAD * 60000 ? at : null;
}

/** The check-in times the coach may promise, as it should say them. */
export function checkInTimes(now: Date, clock: CheckInClock) {
  const today = checkInAt(formatInTimeZone(now, clock.timezone, "yyyy-MM-dd"), now, clock);
  return { today: today ? formatInTimeZone(today, clock.timezone, "HH:mm") : null, laterDays: clock.morning };
}
