import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";

import { useSession } from "@/auth/provider";
import { useCurrentUser } from "@/data/queries";
import { reconcileIosNotifications } from "../notifications";

export function NotificationRegistration() {
  const session = useSession();
  const user = useCurrentUser(session.isSignedIn);
  const syncing = useRef(false);

  useEffect(() => {
    if (
      Platform.OS !== "ios" ||
      !session.isSignedIn ||
      !session.userId ||
      !user.data
    ) {
      return;
    }

    let cancelled = false;
    const sync = async () => {
      if (cancelled || syncing.current) return;
      syncing.current = true;
      try {
        const result = await reconcileIosNotifications({
          userId: session.userId!,
          serverEnabled: Boolean(user.data?.isIosNotificationsEnabled),
          serverToken: user.data?.iosDeviceToken,
        });
        if (!cancelled && result === "updated") {
          await user.refetch();
        }
      } catch {
        // A foreground retry will repair transient API or APNs registration errors.
      } finally {
        syncing.current = false;
      }
    };

    void sync();
    const foreground = AppState.addEventListener("change", (state) => {
      if (state === "active") void sync();
    });
    return () => {
      cancelled = true;
      foreground.remove();
    };
  }, [
    session.isSignedIn,
    session.userId,
    user.data?.isIosNotificationsEnabled,
    user.data?.iosDeviceToken,
  ]);

  return null;
}
