/** The session's day is independent of the device timezone. */
export function sessionDay(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function sessionLogDate(
  day: string,
  timezone: string,
  now = new Date(),
) {
  if (sessionDay(now, timezone) === day) return now;
  // Noon UTC is close to noon locally; choose an instant inside the requested day.
  const noon = Date.parse(`${day}T12:00:00Z`);
  for (const offset of [0, -12, 12]) {
    const candidate = new Date(noon + offset * 3600000);
    if (sessionDay(candidate, timezone) === day) return candidate;
  }
  throw new Error("This date is unavailable in the session timezone");
}
