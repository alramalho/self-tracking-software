/* eslint-disable react-refresh/only-export-components */
"use client";

import { useApiWithAuth } from "@/api";
import { useSession } from "@/contexts/auth";
import { useDataNotifications } from "@/contexts/notifications";
import { useCurrentUser } from "@/contexts/users";
import { arrayBufferToBase64Async, isNotifySupported } from "@/lib/utils";
import { type Notification as PrismaNotification } from "@tsw/prisma";
import React, {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState
} from "react";
import { getSerwist } from "virtual:serwist";

interface NotificationsWebContextType {
  notificationCount: number;
  addToNotificationCount: (count: number, type?: 'profile' | 'general') => void;
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

const NotificationsWebContext = createContext<
  NotificationsWebContextType | undefined
>(undefined);

export const NotificationsWebProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const { notifications } = useDataNotifications();
  const { updateUser } = useCurrentUser();
  const { isSignedIn } = useSession();
  const [notificationCount, setNotificationCount] = useState(0);
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
    if (notifications) {
      const nonConcludedNotificationsCount = notifications.filter(
        (notification: PrismaNotification) => notification.status !== "CONCLUDED"
      ).length || 0;

      const totalBadgeCount = nonConcludedNotificationsCount;

      if (navigator.setAppBadge) {
        navigator.setAppBadge(totalBadgeCount);
      }
    }
  }, [notifications]);

  // Only unsubscribe when explicitly disabling (when isPushGranted becomes false)
  useEffect(() => {
    if (!isPushGranted && subscription) {
      subscription
        .unsubscribe()
        .then((result) => {
          if (result) {
            console.log("Notifications disabled", result);
            setSubscription(null);
          } else {
            console.log("Notifications were not succesfully disabled", result);
          }
        })
        .catch((err) => {
          console.error("Error unsubscribing from push notifications", err);
        });
    }
  }, [isPushGranted, subscription]);

  useEffect(() => {
    const isInPWA = window.matchMedia("(display-mode: standalone)").matches;
    setIsAppInstalled(isInPWA);
  }, []);

  useEffect(() => {
    // Check if all the features we want are available
    const hasRequisite = isNotifySupported();
    setIsPwaSupported(hasRequisite);

    if ('serviceWorker' in navigator && hasRequisite) {
      try {
        setIsPushGranted(Notification.permission === "granted");
      } catch (err) {
        console.info(err);
      }

      const appinstalled = (event: any) => {
        console.log("App installed: " + event);
      };

      // Register the service worker using Serwist's Vite API
      const loadSerwist = async () => {
        try {
          const serwist = await getSerwist();

          if (serwist) {
            serwist.addEventListener("installed", () => {
              console.log("Serwist installed!");
            });

            const reg = await serwist.register();
            if (reg) {
              console.log(
                "Service worker registered with scope: " + reg.scope
              );
              setRegistration(reg);
            } else {
              console.log("Service worker registration returned undefined");
            }
          } else {
            console.log("Serwist is not available");
          }
        } catch (err) {
          console.error("Service worker registration error:", err);
        }
      };

      loadSerwist();

      window.addEventListener("appinstalled", appinstalled);

      return () => {
        window.removeEventListener("appinstalled", appinstalled);
      };
    } else {
      console.log(
        "Service workers are not available or the requisite features are not available"
      );
    }
  }, []);


  const addToNotificationCount = (count: number) => {
    setNotificationCount(prev => prev + count);
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

          console.log("Starting subscription");
          // Wait for the registration to be available
          const reg = registration || await navigator.serviceWorker.ready;
          if (reg) {
            console.log("Registration available");
            // Check permission state again
            const pm = await reg.pushManager.permissionState({
              userVisibleOnly: true,
            });
            if (pm === "granted") {
              console.log("Permission state is granted");
              try {
                const subscription = await reg.pushManager.subscribe({
                  userVisibleOnly: true,
                  applicationServerKey:
                    import.meta.env.VITE_VAPID_PUBLIC_KEY,
                });
                setSubscription(subscription);
                console.log("Subscription set");
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

        await updateUser({
          updates: {
            isPwaInstalled: true,
            isPwaNotificationsEnabled: true,
            pwaSubscriptionEndpoint: subscription.endpoint,
            pwaSubscriptionKey: p256dh,
            pwaSubscriptionAuthToken: auth,
          },
          muteNotifications: true,
        });
      } catch (error) {
        console.error("Failed to update PWA status:", error);
        console.log("Failed to update PWA status: " + error);
      }
    },
    [updateUser]
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
    <NotificationsWebContext.Provider
      value={{
        notificationCount,
        addToNotificationCount,
        sendLocalNotification,
        sendPushNotification,
        requestPermission,
        isAppInstalled,
        isPushGranted,
        setIsPushGranted,
      }}
    >
      {children}
    </NotificationsWebContext.Provider>
  );
};

export const useNotificationsWeb = (): NotificationsWebContextType => {
  const context = useContext(NotificationsWebContext);
  if (context === undefined) {
    throw new Error(
      "useNotificationsWeb must be used within a NotificationsWebProvider"
    );
  }
  return context;
};
