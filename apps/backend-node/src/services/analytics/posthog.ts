import { logger } from "../../utils/logger";
import type { ServerAnalyticsEvent } from "./types";

// Same PostHog project as the web and native apps. Events use the database user id,
// matching their identify() calls. Never send health measurements or profile fields.
const host = process.env.POSTHOG_HOST || "https://eu.i.posthog.com";

export function captureServerEvent({ userId, event, properties }: ServerAnalyticsEvent) {
  const apiKey = process.env.POSTHOG_API_KEY;
  if (!apiKey) return;
  void fetch(`${host}/i/v0/e/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      event,
      distinct_id: userId,
      properties: { ...properties, $lib: "backend-node" },
    }),
    signal: AbortSignal.timeout(5000),
  }).catch((error) => logger.warn(`PostHog capture failed for ${event}:`, error));
}
