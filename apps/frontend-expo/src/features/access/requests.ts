import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { enableIosNotifications } from "@/native/notifications";
import { healthBridge } from "@/native/health/bridge";
import { healthStatus, locationStatus, notificationStatus } from "./model";
import type { AccessContext, AccessKind, AccessStatus, AccessStatuses } from "./types";

function systemNotificationStatus(
  permission: Notifications.NotificationPermissionsStatus,
) {
  if (
    permission.granted ||
    permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  )
    return "granted" as const;
  return permission.status === "denied" ? ("denied" as const) : ("undetermined" as const);
}

export async function readStatuses(
  kinds: AccessKind[],
  context: AccessContext,
): Promise<AccessStatuses> {
  const statuses: AccessStatuses = {};
  if (kinds.includes("notifications"))
    statuses.notifications = notificationStatus(
      systemNotificationStatus(await Notifications.getPermissionsAsync()),
      context.notificationsEnabled,
    );
  if (kinds.includes("location"))
    statuses.location = locationStatus(
      (await Location.getForegroundPermissionsAsync()).status as
        | "granted"
        | "denied"
        | "undetermined",
    );
  if (kinds.includes("health"))
    statuses.health = healthStatus(
      !!healthBridge && context.healthAvailable,
      context.healthEnabled,
    );
  return statuses;
}

// Shows the iOS prompt for one kind and returns what the person chose.
export async function requestAccess(
  kind: AccessKind,
  userId: string | undefined,
  connectHealth: () => void,
): Promise<AccessStatus> {
  if (kind === "notifications") {
    await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    const granted =
      systemNotificationStatus(await Notifications.getPermissionsAsync()) === "granted";
    // Registers this phone for coach, circle and reminder pushes (not possible on a simulator).
    if (granted) await enableIosNotifications(userId).catch(() => undefined);
    return granted ? "allowed" : "off";
  }
  if (kind === "location") {
    const permission = await Location.requestForegroundPermissionsAsync();
    return permission.granted ? "allowed" : "off";
  }
  if (!healthBridge) return "unavailable";
  await healthBridge.requestAuthorization();
  // The first sync runs in the background; the sheet moves on.
  connectHealth();
  return "allowed";
}
