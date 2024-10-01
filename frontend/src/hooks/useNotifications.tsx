"use client";

import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";
import { isNotifySupported } from "@/app/swSupport";
import { useApiWithAuth } from "@/api";
import { arrayBufferToBase64Async } from "@/lib/utils";

interface NotificationsContextType {
  notificationCount: number;
  addNotifications: (count: number) => void;
  clearNotifications: () => void;
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
  requestPermission: () => Promise<void>;
  isAppInstalled: boolean;
  isPushGranted: boolean;
  setIsPushGranted: (isPushGranted: boolean) => void;
  alertSubscriptionEndpoint: () => void;
}

const NotificationsContext = createContext<
  NotificationsContextType | undefined
>(undefined);

export const NotificationsProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
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
    if (subscription) {
      console.log("Subscription:" + subscription.endpoint);
    }
  }, [subscription]);

  useEffect(() => {
    if (registration) {
      console.log(
        `Registration: ${JSON.stringify(
          registration
        )}\nRegistration.active: ${JSON.stringify(registration.active)}\n`
      );
      if (registration.active) {
        console.log("Registration.active: " + JSON.stringify(registration.active));
        registration.active.addEventListener("push", (event) => {
          console.log("Push message received from within:", event);
          // if (event.data) {
          //   const data = event.data.json();
          //   console.log("Push data:", data);
          //   event.waitUntil(
          //     registration.showNotification(data.title, {
          //       body: data.body,
          //       icon: data.icon || "/icons/icon-192x192.png",
          //       data: { url: data.url },
          //     })
          //   );
          // }
        });
        if (registration.active.state === "activated") {
          console.log("Registration.active.state: " + registration.active.state);
          setIsAppInstalled(true);
        }
      }
    }
  }, [registration]);

  const alertSubscriptionEndpoint = () => {
    if (subscription) {
      console.log("Subscription:" + subscription.endpoint);
    } else {
      console.log("No subscription");
    }
  };

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

      const beforeinstallprompt = (event: any) => {
        console.log("Before install prompt: " + event);
      };

      const appinstalled = (event: any) => {
        console.log("App installed: " + event);
      };

      // Register the service worker
      window.serwist
        .register()
        .then((result: ServiceWorkerRegistration | undefined) => {
          if (result) {
            console.log("Service worker registered with scope: " + result.scope);
            setRegistration(result);
          } else {
            console.log("Service worker registration failed");
          }
        })
        .catch((err: any) => console.log(err))
        .catch((err: Error) => console.warn(err));

      window.addEventListener("beforeinstallprompt", beforeinstallprompt);
      window.addEventListener("appinstalled", appinstalled);

      return () => {
        window.removeEventListener("beforeinstallprompt", beforeinstallprompt);
        window.removeEventListener("appinstalled", appinstalled);
      };
    } else {
      console.log(
        "Serwist is not available or the requisite features are not available"
      );
    }
  }, []);

  useEffect(() => {
    navigator.setAppBadge && navigator.setAppBadge(notificationCount);
  }, [notificationCount]);

  const addNotifications = (count: number) =>
    setNotificationCount((prev) => prev + count);

  const clearNotifications = async () => {
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
      addNotifications(1);
    } else {
      console.warn(
        "Notification permission not granted or registration not available"
      );
    }
  };

  const requestPermission = async () => {
    try {
      if (isPwaSupported) {
        const result = await Notification.requestPermission();
        if (result === "granted") {
          setIsPushGranted(true);

          // Wait for the registration to be available
          if (registration) {
            // Check permission state again
            const pm = await registration.pushManager.permissionState({
              userVisibleOnly: true,
            });
            if (pm === "granted") {
              try {
                const subscription = await registration.pushManager.subscribe({
                  userVisibleOnly: true,
                  applicationServerKey:
                    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
                });
                setSubscription(subscription);
                console.log("Push endpoint:" + subscription.endpoint);
                // Use api in a useCallback hook
                await updatePwaStatus(subscription);
              } catch (err) {
                console.error("Failed to subscribe:", err);
                console.log("Failed to subscribe: " + err);
              }
            } else {
              console.log("Push manager permission state is: " + pm);
            }
          } else {
            console.log("Registration not available");
          }
        } else {
          console.log("Notification permission was not granted. State: " + result);
        }
      } else {
        console.log("You need to install this web page to use notifications");
      }
    } catch (err) {
      console.error("Error in requestPermission:", err);
      console.log("Error: " + err);
    }
  };

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
        await api.post("/api/update-pwa-status", {
          is_pwa_installed: true,
          is_pwa_notifications_enabled: true,
          pwa_subscription_endpoint: subscription.endpoint,
          pwa_subscription_key: p256dh,
          pwa_subscription_auth_token: auth,
        });
        console.log("PWA status updated");
      } catch (error) {
        console.error("Failed to update PWA status:", error);
        console.log("Failed to update PWA status: " + error);
      }
    },
    [api]
  );

  const sendPushNotification = async (
    title: string,
    body: string,
    icon?: string,
    url?: string
  ) => {
    try {
      await api.post("/api/trigger-push-notification", {
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
        addNotifications,
        clearNotifications,
        sendLocalNotification,
        sendPushNotification,
        requestPermission,
        isAppInstalled,
        isPushGranted,
        setIsPushGranted,
        alertSubscriptionEndpoint,
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
