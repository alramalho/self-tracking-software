import type { IosNotificationPreference } from "./types";

export function wantsIosNotifications(
  localPreference: IosNotificationPreference | null,
  serverEnabled: boolean,
): boolean {
  if (localPreference === "disabled") return false;
  if (localPreference === "enabled") return true;
  return serverEnabled;
}

export function isCurrentIosNotificationRegistration(
  serverEnabled: boolean,
  serverToken: string | null | undefined,
  deviceToken: string,
): boolean {
  return serverEnabled && serverToken === deviceToken;
}
