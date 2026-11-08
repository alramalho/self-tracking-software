import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import type { CheckInClock, CheckInTimes } from "./types";

/** With no time named, the coach checks that evening: late enough for the session to have happened. */
const USUAL = "20:00";
/** Never later than this, and never earlier than this on a later day. */
const LATEST = "22:00";
const EARLIEST = "08:00";
/** Today's check-in is at least this far away, on a half hour, so there's time to do the session. */
const MIN_MINUTES_AHEAD = 45;
const ROUND_MINUTES = 30;

const clockTime = (value: string) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : "");

/** The times the coach may pick from, as it should say them. `earliestToday` is null when today is too late. */
export function checkInTimes(now: Date, clock: CheckInClock): CheckInTimes {
  const step = ROUND_MINUTES * 60000;
  const earliest = new Date(Math.ceil((now.getTime() + MIN_MINUTES_AHEAD * 60000) / step) * step);
  const today = formatInTimeZone(now, clock.timezone, "yyyy-MM-dd");
  const time = formatInTimeZone(earliest, clock.timezone, "HH:mm");
  const sameDay = formatInTimeZone(earliest, clock.timezone, "yyyy-MM-dd") === today;
  return { earliestToday: sameDay && time <= LATEST ? time : null, latest: LATEST, usual: USUAL };
}

/**
 * When the coach checks whether a committed session happened: the time it picked from the person's
 * words (a little after when they said they'd train), else the evening, kept between the earliest
 * possible time and 22:00. Null when it's too late today.
 */
export function resolveCheckTime(day: string, today: string, wanted: string, times: CheckInTimes): string | null {
  const time = clockTime(wanted) || times.usual;
  const earliest = day === today ? times.earliestToday : EARLIEST;
  if (!earliest) return null;
  if (time < earliest) return earliest;
  return time > times.latest ? times.latest : time;
}

/** A day and a clock time in the person's timezone, as an instant. */
export const zoned = (day: string, time: string, clock: CheckInClock) => fromZonedTime(`${day}T${time}:00`, clock.timezone);
