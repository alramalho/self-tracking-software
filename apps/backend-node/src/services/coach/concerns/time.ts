import { TZDate } from "@date-fns/tz";
import type { User } from "@tsw/prisma";

// User-tz hour falls in [preferredCoachingHour, preferredCoachingHour + 2).
// Mirrors isWithinPreferredCoachWindow in the assessment service; duplicated
// here to keep the concerns module free of assessment-service imports.
export function isWithinPreferredCoachWindow(
  user: Pick<User, "timezone" | "preferredCoachingHour">,
  now: Date
): boolean {
  const userTime = new TZDate(now, user.timezone || "UTC");
  const userHour = userTime.getHours();
  const preferredStartHour = user.preferredCoachingHour ?? 6;
  return userHour >= preferredStartHour && userHour < preferredStartHour + 2;
}
