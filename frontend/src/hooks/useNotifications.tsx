"use client";

import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useCallback,
} from "react";
import { isNotifySupported } from "@/app/swSupport";
import { useApiWithAuth } from "@/api";
import { arrayBufferToBase64Async } from "@/lib/utils";
import { useUserPlan } from "@/contexts/UserGlobalContext";
import { useSession } from "@clerk/nextjs";
import { useDailyCheckin } from "@/contexts/DailyCheckinContext";
import { Notification as NotificationType } from "@/zero/schema";

interface NotificationsContextType {
  notificationCount: number;
  dailyCheckinNotification: boolean;
  addToNotificationCount: (count: number, type?: 'profile' | 'general') => void;
  clearGeneralNotifications: () => void;
  sendLocalNotification: (
    title: string,
    body: string,
    icon?: string,
    url?: string
  ) => Promise<void>;
  sendPushNotification: (
    title: string,
    body: string,
    icon?: string,
    url?: string
  ) => Promise<void>;
  requestPermission: () => Promise<boolean | undefined>;
  isAppInstalled: boolean;
  isPushGranted: boolean;
  setIsPushGranted: (isPushGranted: boolean) => void;
}

const NotificationsContext = createContext<
  NotificationsContextType | undefined
>(undefined);

export const NotificationsProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const { useCurrentUserDataQuery } = useUserPlan();
  const userData = useCurrentUserDataQuery();
  const { isSignedIn } = useSession();
  const [notificationCount, setNotificationCount] = useState(0);
  const { shouldShowNotification } = useDailyCheckin();
  const [dailyCheckinNotification, setDailyCheckinNotification] = useState(false);

  const [isAppInstalled, setIsAppInstalled] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(
    null
  );

  const [isPwaSupported, setIsPwaSupported] = useState(false);
  const [isPushGranted, setIsPushGranted] = useState(false);
  const [registration, setRegistration] =
    useState<ServiceWorkerRegistration | null>(null);

  const api = useApiWithAuth();

  useEffect(() => {
    if (userData.data) {
      const nonConcludedNotificationsCount = userData.data.notifications?.filter(
        (notification: NotificationType) => notification.status !== "CONCLUDED"
      ).length || 0;
      
      // Add 1 to the badge count if there's a daily check-in notification
      const totalBadgeCount = nonConcludedNotificationsCount + (dailyCheckinNotification ? 1 : 0);
      
      if (navigator.setAppBadge) {
        navigator.setAppBadge(totalBadgeCount);
      }
    }
  }, [userData.data, dailyCheckinNotification]);

  useEffect(() => {
    subscription
      ?.unsubscribe()
      .then((result) => {
        if (result) {
          console.log("Notifications disabled", result);
          setIsPushGranted(false);
        } else {
          console.log("Notifications were not succesfully disabled", result);
        }
      })
      .catch((err) => {
        console.error("Error unsubscribing from push notifications", err);
      });
  }, [isPushGranted]);

  useEffect(() => {
    const isInPWA = window.matchMedia("(display-mode: standalone)").matches;
    setIsAppInstalled(isInPWA);
  }, []);

  useEffect(() => {
    // Check if all the features we want are available
    // In practice, it is better to check for each feature separately and allow users to opt-in
    // to each feature on demand.
    const hasRequisite = isNotifySupported();
    setIsPwaSupported(hasRequisite);

    if (window.serwist !== undefined && hasRequisite) {
      try {
        setIsPushGranted(Notification.permission === "granted");
      } catch (err) {
        console.info(err);
      }

      const appinstalled = (event: any) => {
        console.log("App installed: " + event);
      };

      // Register the service worker
      window.serwist
        .register()
        .then((result: ServiceWorkerRegistration | undefined) => {
          if (result) {
            console.log(
              "Service worker registered with scope: " + result.scope
            );
            setRegistration(result);
          } else {
            console.log("Service worker registration failed");
          }
        })
        .catch((err: any) => console.log(err))
        .catch((err: Error) => console.warn(err));

      window.addEventListener("appinstalled", appinstalled);

      return () => {
        window.removeEventListener("appinstalled", appinstalled);
      };
    } else {
      console.log(
        "Serwist is not available or the requisite features are not available"
      );
    }
  }, []);

  useEffect(() => {
    setDailyCheckinNotification(shouldShowNotification);
  }, [shouldShowNotification]);

  const addToNotificationCount = (count: number) => {
    setNotificationCount(prev => prev + count);
  };

  const clearAllNotifications = async () => {
    setNotificationCount(0);
    
    if (navigator.clearAppBadge) {
      await navigator.clearAppBadge();
    }
    if (registration) {
      const notifications = await registration.getNotifications();
      notifications.forEach((notification) => notification.close());
    }

    
  };

  const sendLocalNotification = async (
    title: string,
    body: string,
    icon?: string,
    url?: string
  ) => {
    if (Notification.permission !== "granted") {
      await requestPermission();
    }

    if (Notification.permission === "granted" && registration) {
      await registration.showNotification(title, {
        body,
        icon,
        data: { url },
      });
      addToNotificationCount(1);
    } else {
      console.warn(
        "Notification permission not granted or registration not available"
      );
    }
  };

  const requestPermission = async (): Promise<boolean | undefined> => {
    try {
      if (isPwaSupported) {
        const notificationPermissionResult = await Notification.requestPermission();
        const granted = isPushGranted || notificationPermissionResult === "granted";
        if (granted) {
          setIsPushGranted(true);

          // Wait for the registration to be available
          const reg = registration || await navigator.serviceWorker.ready;
          if (reg) {
            // Check permission state again
            const pm = await reg.pushManager.permissionState({
              userVisibleOnly: true,
            });
            if (pm === "granted") {
              try {
                const subscription = await reg.pushManager.subscribe({
                  userVisibleOnly: true,
                  applicationServerKey:
                    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
                });
                setSubscription(subscription);
                // Use api in a useCallback hook
                await updatePwaStatus(subscription);
              } catch (err) {
                console.error("Failed to subscribe:", err);
              }
            } else {
              console.log("Push manager permission state is: " + pm);
            }
          } else {
            console.log("Registration not available");
          }
        } else {
          console.log(
            "Notification permission was not granted. State: " + notificationPermissionResult
          );
        }
        return granted
      } else {
        console.log("You need to install this web page to use notifications");
      }
    } catch (err) {
      console.error("Error in requestPermission:", err);
      console.log("Error: " + err);
    }
  };

  const validateAndUpdateSubscription = async () => {
    if (!isPushGranted || !isSignedIn) return;

    try {
      // Get registration if we don't have it
      const reg = registration || await navigator.serviceWorker.ready;
      if (!reg) {
        console.error('No service worker registration available');
        return;
      }

      // Get current subscription
      const currentSubscription = await reg.pushManager.getSubscription();
      
      // Get stored endpoint from backend
      const response = await api.get("/notifications/get-pwa-subscription");
      const storedEndpoint = response.data.stored_endpoint;

      // Request new permission if:
      // 1. We have no current subscription but push is granted
      // 2. Current subscription endpoint differs from stored one
      if (!currentSubscription || (storedEndpoint && currentSubscription.endpoint !== storedEndpoint)) {
        await requestPermission();
      }
    } catch (error) {
      // Silently handle error as this is a background validation
      console.debug('Error validating subscription:', error);
    }
  };

  useEffect(() => {
    validateAndUpdateSubscription();
  }, [isPushGranted, registration]);

  // Define updatePwaStatus using useCallback
  const updatePwaStatus = React.useCallback(
    async (subscription: PushSubscription) => {
      try {
        const p256dh = await arrayBufferToBase64Async(
          subscription.getKey("p256dh")!
        );
        const auth = await arrayBufferToBase64Async(
          subscription.getKey("auth")!
        );
        await api.post("/notifications/update-pwa-status", {
          is_pwa_installed: true,
          is_pwa_notifications_enabled: true,
          pwa_subscription_endpoint: subscription.endpoint,
          pwa_subscription_key: p256dh,
          pwa_subscription_auth_token: auth,
        });
      } catch (error) {
        console.error("Failed to update PWA status:", error);
        console.log("Failed to update PWA status: " + error);
      }
    },
    []
  );

  const sendPushNotification = async (
    title: string,
    body: string,
    icon?: string,
    url?: string
  ) => {
    try {
      await api.post("/notifications/trigger-push-notification", {
        title,
        body,
        icon,
        url,
      });
      console.log("Push notification sent");
    } catch (error) {
      console.error("Failed to send push notification:", error);
      console.log("Failed to send push notification: " + error);
    }
  };

  return (
    <NotificationsContext.Provider
      value={{
        notificationCount,
        dailyCheckinNotification,
        addToNotificationCount,
        clearGeneralNotifications: clearAllNotifications,
        sendLocalNotification,
        sendPushNotification,
        requestPermission,
        isAppInstalled,
        isPushGranted,
        setIsPushGranted,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
};

export const useNotifications = (): NotificationsContextType => {
  const context = useContext(NotificationsContext);
  if (context === undefined) {
    throw new Error(
      "useNotifications must be used within a NotificationsProvider"
    );
  }
  return context;
};
