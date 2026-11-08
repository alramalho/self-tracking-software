import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

/** Clears this plan's coach notifications from Notification Center once the coach's question is answered. */
export async function dismissPlanNotifications(planId: string) {
  if (Platform.OS === "web") return;
  try {
    const shown = await Notifications.getPresentedNotificationsAsync();
    const forPlan = shown.filter((n) => String(n.request.content.data?.url ?? "").includes(planId));
    await Promise.all(forPlan.map((n) => Notifications.dismissNotificationAsync(n.request.identifier)));
  } catch {
    // Leaving a notification behind is harmless.
  }
}
