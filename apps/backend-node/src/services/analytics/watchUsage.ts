import { captureServerEvent } from "./posthog";

// The Watch app calls the API directly with its own tokens, so only the backend
// can see it being used. One event per user per day keeps the funnel readable.
const DAY_MS = 24 * 60 * 60 * 1000;
const lastReported = new Map<string, number>();

export function shouldReportWatchUse(userId: string, now = Date.now()) {
  const previous = lastReported.get(userId);
  if (previous !== undefined && now - previous < DAY_MS) return false;
  lastReported.set(userId, now);
  return true;
}

export function reportWatchUse(userId: string) {
  if (shouldReportWatchUse(userId))
    captureServerEvent({ userId, event: "watch-used" });
}
