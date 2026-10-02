// Event names follow the web app's kebab-case convention (e.g. "onboarding-completed")
// so web and native funnels line up in the shared PostHog project.
// Never add Apple Health measurements here: the privacy policy excludes them from analytics.

export type PlanCreatedSource = "onboarding" | "create-plan" | "plan-editor";
export type ActivityLogSource = "manual" | "voice";
export type HealthProvider = "apple-health" | "garmin";
export type CircleJoinMethod = "invite-code" | "discover" | "created";
export type PurchasePlacement = "onboarding";
export type PurchaseStore = "stripe" | "app-store";

export interface AnalyticsEvents {
  "onboarding-started": Record<string, never>;
  "onboarding-completed": { coaching: boolean };
  "first-habit-created": { source: PlanCreatedSource };
  "plan-created": { source: PlanCreatedSource; coaching?: boolean };
  "activity-logged": {
    source: ActivityLogSource;
    count: number;
    has_photos?: boolean;
    with_friend?: boolean;
  };
  "streak-milestone-reached": { weeks: number; plan_id: string };
  "coach-opened": { plan_id?: string };
  "coach-message-sent": { has_images: boolean; from_starter: boolean };
  "friend-request-sent": Record<string, never>;
  "friend-added": Record<string, never>;
  "circle-joined": { method: CircleJoinMethod };
  "coach-paywall-viewed": { placement: PurchasePlacement; has_trial: boolean };
  "purchase-started": { placement: PurchasePlacement; store: PurchaseStore };
  "purchase-completed": {
    placement: PurchasePlacement;
    store: PurchaseStore;
    plan_type: string;
  };
  "health-connected": { provider: HealthProvider };
}

export type AnalyticsEvent = keyof AnalyticsEvents;

/** Highest milestone already reported, per plan, for one account. */
export type StreakMilestoneRecord = Record<string, number>;
