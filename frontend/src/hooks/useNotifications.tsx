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
          alert("Notifications disabled");
          setIsPushGranted(false);
        } else {
          console.log("Notifications were not succesfully disabled", result);
          alert("Notifications were not succesfully disabled");
        }
      })
      .catch((err) => {
        console.error("Error unsubscribing from push notifications", err);
      });
  }, [isPushGranted]);

  useEffect(() => {
    if (subscription) {
      alert("Subscription:" + subscription.endpoint);
    }
  }, [subscription]);

  useEffect(() => {
    if (registration) {
      alert(
        `Registration: ${JSON.stringify(
          registration
        )}\nRegistration.active: ${JSON.stringify(registration.active)}\n`
      );
      if (registration.active) {
        alert("Registration.active: " + JSON.stringify(registration.active));
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
          alert("Registration.active.state: " + registration.active.state);
          setIsAppInstalled(true);
        }
      }
    }
  }, [registration]);

  const alertSubscriptionEndpoint = () => {
    if (subscription) {
      alert("Subscription:" + subscription.endpoint);
    } else {
      alert("No subscription");
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
        alert("Before install prompt: " + event);
      };

      const appinstalled = (event: any) => {
        alert("App installed: " + event);
      };

      // Register the service worker
      window.serwist
        .register()
        .then((result: ServiceWorkerRegistration | undefined) => {
          if (result) {
            alert("Service worker registered with scope: " + result.scope);
            setRegistration(result);
          } else {
            alert("Service worker registration failed");
          }
        })
        .catch((err: any) => alert(err))
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
      alert(
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
                alert("Push endpoint:" + subscription.endpoint);
                // Use api in a useCallback hook
                await updatePwaStatus(subscription);
              } catch (err) {
                console.error("Failed to subscribe:", err);
                alert("Failed to subscribe: " + err);
              }
            } else {
              alert("Push manager permission state is: " + pm);
            }
          } else {
            alert("Registration not available");
          }
        } else {
          alert("Notification permission was not granted. State: " + result);
        }
      } else {
        alert("You need to install this web page to use notifications");
      }
    } catch (err) {
      console.error("Error in requestPermission:", err);
      alert("Error: " + err);
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
        alert("PWA status updated");
      } catch (error) {
        console.error("Failed to update PWA status:", error);
        alert("Failed to update PWA status: " + error);
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
      alert("Push notification sent");
    } catch (error) {
      console.error("Failed to send push notification:", error);
      alert("Failed to send push notification: " + error);
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
