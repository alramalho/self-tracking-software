import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "@/data/api";
import {
  isCurrentIosNotificationRegistration,
  wantsIosNotifications,
} from "./notifications/model";
import type {
  IosNotificationPreference,
  IosNotificationReconciliationResult,
  IosNotificationRegistration,
} from "./notifications/types";

function preferenceKey(userId: string): string {
  return `trackingso:notifications:${userId}`;
}

function hasNotificationPermission(
  permission: Notifications.NotificationPermissionsStatus,
): boolean {
  return (
    permission.granted ||
    permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

async function savePreference(
  userId: string,
  preference: IosNotificationPreference,
): Promise<void> {
  await AsyncStorage.setItem(preferenceKey(userId), preference);
}

export async function enableIosNotifications(userId?: string) {
  if (Platform.OS !== "ios")
    throw new Error("iOS push registration requires an iOS device.");
  if (!Device.isDevice)
    throw new Error("Push notifications require a physical device.");
  const permission = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  });
  if (!hasNotificationPermission(permission))
    throw new Error(
      "Allow notifications for tracking.so in Settings to receive reminders.",
    );
  // The existing backend sends directly through APNs; Expo push tokens are incompatible.
  const token = await Notifications.getDevicePushTokenAsync();
  await api.patch("/users/user", {
    isIosNotificationsEnabled: true,
    iosDeviceToken: token.data,
    iosDeviceTokenUpdatedAt: new Date().toISOString(),
  });
  if (userId) await savePreference(userId, "enabled");
}
export async function disableIosNotifications(userId?: string) {
  await api.patch("/users/user", {
    isIosNotificationsEnabled: false,
    iosDeviceToken: null,
  });
  if (userId) await savePreference(userId, "disabled");
}

export async function unregisterIosNotificationsForLogout(): Promise<void> {
  if (Platform.OS !== "ios") return;
  await api.patch("/users/user", {
    isIosNotificationsEnabled: false,
    iosDeviceToken: null,
  });
}

export async function reconcileIosNotifications({
  userId,
  serverEnabled,
  serverToken,
}: IosNotificationRegistration): Promise<IosNotificationReconciliationResult> {
  if (Platform.OS !== "ios" || !Device.isDevice) return "unavailable";

  const storedPreference = (await AsyncStorage.getItem(
    preferenceKey(userId),
  )) as IosNotificationPreference | null;
  if (!wantsIosNotifications(storedPreference, serverEnabled)) {
    return "not-requested";
  }
  if (!storedPreference && serverEnabled) {
    await savePreference(userId, "enabled");
  }

  const permission = await Notifications.getPermissionsAsync();
  if (!hasNotificationPermission(permission)) {
    if (serverEnabled || serverToken) {
      await api.patch("/users/user", {
        isIosNotificationsEnabled: false,
        iosDeviceToken: null,
      });
      return "updated";
    }
    return "permission-denied";
  }

  const token = await Notifications.getDevicePushTokenAsync();
  const deviceToken = String(token.data);
  if (
    isCurrentIosNotificationRegistration(
      serverEnabled,
      serverToken,
      deviceToken,
    )
  ) {
    return "already-current";
  }

  await api.patch("/users/user", {
    isIosNotificationsEnabled: true,
    iosDeviceToken: deviceToken,
    iosDeviceTokenUpdatedAt: new Date().toISOString(),
  });
  return "updated";
}
