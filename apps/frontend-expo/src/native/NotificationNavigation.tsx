import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useSession } from "@/auth/provider";
import { notificationRoute } from "./notification-routing";
export function NotificationNavigation() {
  const session = useSession(),
    seen = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!session.isSignedIn || Platform.OS === "web") return;
    const navigate = (response: Notifications.NotificationResponse | null) => {
      if (
        !response ||
        seen.current === response.notification.request.identifier
      )
        return;
      const path = notificationRoute(
        response.notification.request.content.data?.url,
      ) ?? "/notifications";
      seen.current = response.notification.request.identifier;
      router.push(path as never);
      void Notifications.clearLastNotificationResponseAsync();
    };
    const listener =
      Notifications.addNotificationResponseReceivedListener(navigate);
    void Notifications.getLastNotificationResponseAsync().then(navigate);
    return () => listener.remove();
  }, [session.isSignedIn]);
  return null;
}
