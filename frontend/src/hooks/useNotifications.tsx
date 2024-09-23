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

interface NotificationsContextType {
  notificationCount: number;
  addNotifications: (count: number) => void;
  clearNotifications: () => void;
  sendNotification: (title: string, options: NotificationOptions) => Promise<void>;
  requestPermission: () => Promise<void>;
  isAppInstalled: boolean;
  isPushGranted: boolean;
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
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);

  const [isPwaSupported, setIsPwaSupported] = useState(false);
  const [isPushGranted, setIsPushGranted] = useState(false);
  const [registration, setRegistration] =
    useState<ServiceWorkerRegistration | null>(null);

  const api = useApiWithAuth();

  useEffect(() => {
    if (subscription) {
      alert("Subscription:" + subscription.endpoint);
    }
  }, [subscription]);

  const alertSubscriptionEndpoint = () => {
    if (subscription) {
      alert("Subscription:" + subscription.endpoint);
    } else {
      alert("No subscription");
    }
  };

  useEffect(() => {
    const isInPWA = window.matchMedia('(display-mode: standalone)').matches;
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
        .then((result: any) => setRegistration(result))
        .catch((err: any) => alert(err))
        .catch((err: Error) => console.warn(err));

      window.addEventListener("beforeinstallprompt", beforeinstallprompt);
      window.addEventListener("appinstalled", appinstalled);

      return () => {
        window.removeEventListener("beforeinstallprompt", beforeinstallprompt);
        window.removeEventListener("appinstalled", appinstalled);
      };
    } else {
      console.warn(
        "Serwist is not available or the requisite features are not available"
      );
    }
  }, []);

  useEffect(() => {
    console.info(
      "Service worker registration state: ",
      registration?.active?.state
    );
    setIsAppInstalled(registration?.active?.state === "activated");
  }, [registration?.active?.state]);

  useEffect(() => {
    navigator.setAppBadge && navigator.setAppBadge(notificationCount);
  }, [notificationCount]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then(setRegistration);
    }
  }, []);

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

  const sendNotification = async (
    title: string,
    options: NotificationOptions
  ) => {
    if (Notification.permission !== "granted") {
      await requestPermission();
    }
    
    if (Notification.permission === "granted" && registration) {
      await registration.showNotification(title, options);
      addNotifications(1);
    } else {
      console.warn("Notification permission not granted or registration not available");
    }
  };

  const requestPermission = async () => {
    try {
      if (isPwaSupported) {
        const result = await Notification.requestPermission();
        if (result === "granted") {
          setIsPushGranted(true);

          // Wait for the registration to be available
          const reg = await navigator.serviceWorker.ready;
          setRegistration(reg);

          // Check permission state again
          const pm = await reg.pushManager.permissionState({userVisibleOnly: true});
          if (pm === "granted") {
            try {
              const subscription = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
              });
              setSubscription(subscription);
              alert("Push endpoint:" + subscription.endpoint);
              // Use api in a useCallback hook
              await updatePwaStatus(subscription.endpoint);
            } catch (err) {
              console.error("Failed to subscribe:", err);
              alert("Failed to subscribe: " + err);
            }
          } else {
            alert("Push manager permission state is: " + pm);
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
  const updatePwaStatus = React.useCallback(async (endpoint: string) => {
    try {
      await api.post("/api/update-pwa-status", {
        is_pwa_installed: true,
        is_pwa_notifications_enabled: true,
        pwa_endpoint: endpoint,
      });
      alert("PWA status updated");
    } catch (error) {
      console.error("Failed to update PWA status:", error);
      alert("Failed to update PWA status: " + error);
    }
  }, [api]);

  return (
    <NotificationsContext.Provider
      value={{
        notificationCount,
        addNotifications,
        clearNotifications,
        sendNotification,
        requestPermission,
        isAppInstalled,
        isPushGranted,
        alertSubscriptionEndpoint
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
