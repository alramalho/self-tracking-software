import type {
  AccessItem,
  AccessKind,
  AccessRequest,
  AccessStatus,
  AccessStatuses,
} from "./types";

// Apple Guideline 5.1.1(iv): an explanation before a permission prompt must
// lead to that prompt. So the checklist's only button says Continue (never
// Allow) and there is no "Not now"; people decline in the iOS prompt itself.

export const accessTitles: Record<AccessKind, string> = {
  notifications: "Notifications",
  health: "Apple Health",
  location: "Location",
};

export function notificationStatus(
  system: "granted" | "denied" | "undetermined",
  enabledInApp: boolean,
): AccessStatus {
  if (system === "denied") return "off";
  // Allowed in iOS but switched off in tracking.so Settings still needs a yes.
  return system === "granted" && enabledInApp ? "allowed" : "pending";
}

export function locationStatus(
  system: "granted" | "denied" | "undetermined",
): AccessStatus {
  if (system === "granted") return "allowed";
  return system === "denied" ? "off" : "pending";
}

// HealthKit never says which read types were allowed, so "allowed" means the
// person went through Apple's sheet and tracking.so syncs.
export function healthStatus(available: boolean, enabled: boolean): AccessStatus {
  if (!available) return "unavailable";
  return enabled ? "allowed" : "pending";
}

export function shownItems(items: AccessItem[], statuses: AccessStatuses) {
  return items.filter((item) => (statuses[item.kind] ?? "unavailable") !== "unavailable");
}

export function pendingKinds(items: AccessItem[], statuses: AccessStatuses) {
  return items
    .filter((item) => statuses[item.kind] === "pending")
    .map((item) => item.kind);
}

export function statusLabel(kind: AccessKind, status?: AccessStatus) {
  // HealthKit hides what was declined, so Apple Health only says it's done.
  if (status === "allowed") return kind === "health" ? "Done" : "Allowed";
  return status === "off" ? "Off" : null;
}

// The coach can use watch data from Apple Health or Garmin; Garmin people
// shouldn't be asked for Apple Health.
export function coachNeedsAppleHealth(
  dataAccess: { workouts: boolean; sleep: boolean },
  garminConnected: boolean,
) {
  return (dataAccess.workouts || dataAccess.sleep) && !garminConnected;
}

export function buttonLabel(items: AccessItem[], statuses: AccessStatuses) {
  return pendingKinds(items, statuses).length ? "Continue" : "Done";
}

// Where each feature asks, in its own words.
export const accessRequests = {
  coach: (coach: string, health: boolean): AccessRequest => ({
    title: `${coach} needs access`,
    subtitle: "to check in with you",
    items: [
      {
        kind: "notifications",
        detail: `Check-ins, weekly reviews and replies from ${coach}`,
      },
      ...(health
        ? [
            {
              kind: "health" as const,
              detail: "Workouts, heart rate and sleep from Apple Health",
            },
          ]
        : []),
    ],
  }),
  circle: (): AccessRequest => ({
    title: "tracking.so needs access",
    subtitle: "so your circle can cheer you on",
    items: [
      {
        kind: "notifications",
        detail: "Cheers, check-ins and messages from your circle",
      },
    ],
  }),
  reminders: (): AccessRequest => ({
    title: "tracking.so needs access",
    subtitle: "to remind you on planned days",
    items: [
      { kind: "notifications", detail: "One reminder for each planned session" },
    ],
  }),
  appleHealth: (): AccessRequest => ({
    title: "tracking.so needs access",
    subtitle: "to log your workouts for you",
    items: [
      {
        kind: "health",
        detail: "Reads workouts, routes, heart rate and sleep. Never writes.",
      },
      {
        kind: "notifications",
        detail: "A heads-up when a workout ends, so you can log it in one tap",
      },
    ],
  }),
  logLocation: (): AccessRequest => ({
    title: "tracking.so needs access",
    subtitle: "to add where you trained to this log",
    items: [
      {
        kind: "location",
        detail: "Only while you use the app, and only when you tap Add location",
      },
    ],
  }),
  nearbyCircle: (): AccessRequest => ({
    title: "tracking.so needs access",
    subtitle: "to match you with people in your city",
    items: [
      {
        kind: "location",
        detail: "Rounded to your city. Others only see “same city”.",
      },
    ],
  }),
};
