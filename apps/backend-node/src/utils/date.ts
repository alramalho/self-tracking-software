import { TZDate } from "@date-fns/tz";
import { endOfWeek, format, startOfWeek, subDays } from "date-fns";

const COACH_WEEK_STARTS_ON = 0;

export const todaysLocalDate = () => {
  return new Date(format(new Date(), "yyyy-MM-dd") + "T00:00:00.000Z");
};

export const toMidnightUTCDate = (date: Date) => {
  const newDate = new Date(format(date, "yyyy-MM-dd") + "T00:00:00.000Z");
  return newDate;
};

export function getCoachWeekBounds(now: Date, timezone?: string | null) {
  const nowInTz = new TZDate(now, timezone || "UTC");
  const start = startOfWeek(nowInTz, { weekStartsOn: COACH_WEEK_STARTS_ON });
  const end = endOfWeek(start, { weekStartsOn: COACH_WEEK_STARTS_ON });
  return { start, end };
}

export function getPreviousCoachWeekBounds(now: Date, timezone?: string | null) {
  return getCoachWeekBounds(
    subDays(new TZDate(now, timezone || "UTC"), 7),
    timezone
  );
}
