export const ACTIVITY_CATEGORIES = ["running", "other"] as const;

export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

export const DEFAULT_ACTIVITY_CATEGORY: ActivityCategory = "other";
