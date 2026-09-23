import type { PhotoNotificationEligibility } from "./types";

const PHOTO_NOTIFICATION_WINDOW_MS = 12 * 60 * 60 * 1000;

function localDate(value: Date, requestedTimezone: string | null | undefined) {
  let timezone = requestedTimezone || "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
  } catch {
    timezone = "UTC";
  }
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  return ["year", "month", "day"]
    .map((part) => parts.find((item) => item.type === part)?.value)
    .join("-");
}

export function isActivityPhotoNotificationEligible({
  completedAt,
  timezone,
  now,
}: PhotoNotificationEligibility): boolean {
  const age = now.getTime() - completedAt.getTime();
  return (
    Number.isFinite(age) &&
    age >= 0 &&
    age <= PHOTO_NOTIFICATION_WINDOW_MS &&
    localDate(completedAt, timezone) === localDate(now, timezone)
  );
}
