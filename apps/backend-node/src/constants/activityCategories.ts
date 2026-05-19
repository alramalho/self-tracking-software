export const ACTIVITY_KINDS = [
  "running",
  "walking",
  "cycling",
  "hiking",
  "swimming",
  "surfing",
  "skating",
  "kayaking",
  "gym",
  "boxing",
  "bouldering",
  "yoga",
  "meditation",
  "reading",
  "other",
] as const;

export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export const DEFAULT_ACTIVITY_KIND: ActivityKind = "other";

export const GPS_TRACKABLE_KINDS: ReadonlySet<ActivityKind> = new Set([
  "running",
  "walking",
  "cycling",
  "hiking",
  "swimming",
  "surfing",
  "skating",
  "kayaking",
]);
