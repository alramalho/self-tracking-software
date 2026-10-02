import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";
import PostHog from "posthog-react-native";
import type { AnalyticsEvent, AnalyticsEvents, PlanCreatedSource } from "./types";

// Same PostHog project as the web app (VITE_POSTHOG_KEY / VITE_POSTHOG_HOST),
// so a person identified on both platforms is one PostHog person.
// Development and E2E builds only log events; the Expo web target is not the product web app.
const extra = Constants.expoConfig?.extra;
const apiKey: string | undefined = extra?.posthogKey;
const sending =
  !!apiKey && Platform.OS !== "web" && !__DEV__ && !extra?.fixtureMode;

const posthog = sending
  ? new PostHog(apiKey, {
      host: extra?.posthogHost || "https://eu.i.posthog.com",
      customStorage: AsyncStorage,
      captureAppLifecycleEvents: true,
      enableSessionReplay: false,
      personProfiles: "identified_only",
      // No IP-derived location: the App Store privacy label declares none.
      disableGeoip: true,
    })
  : null;

export function track<E extends AnalyticsEvent>(
  event: E,
  ...[properties]: AnalyticsEvents[E] extends Record<string, never>
    ? []
    : [AnalyticsEvents[E]]
) {
  if (__DEV__) console.log("[analytics]", event, properties ?? {});
  posthog?.capture(event, properties);
}

/** Uses the database user id, exactly like the web app, and no profile fields. */
export function identify(userId: string) {
  if (posthog?.getDistinctId() !== userId) posthog?.identify(userId);
}

export function resetAnalytics() {
  posthog?.reset();
}

export function trackPlanCreated(
  source: PlanCreatedSource,
  isFirstPlan: boolean,
  coaching?: boolean,
) {
  track("plan-created", { source, coaching });
  if (isFirstPlan) track("first-habit-created", { source });
}
