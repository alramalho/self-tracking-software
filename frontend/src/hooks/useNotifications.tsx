"use client";

import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";
import { isNotifySupported } from "@/app/swSupport";

interface NotificationsContextType {
  notificationCount: number;
  addNotifications: (count: number) => void;
  clearNotifications: () => void;
  sendNotification: (title: string, options: NotificationOptions) => Promise<void>;
  requestPermission: () => Promise<void>;
  isAppInstalled: boolean;
  isPushGranted: boolean;
  isPeriodicSyncEnabled: boolean;
  setupPeriodicSync: () => Promise<void>;
  cancelPeriodicSync: () => Promise<void>;
  triggerPeriodicSync: () => Promise<void>;
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
  const [isPeriodicSyncEnabled, setIsPeriodicSyncEnabled] = useState(false);
  const [registration, setRegistration] =
    useState<ServiceWorkerRegistration | null>(null);

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
  });

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
      if (isPwaSupported)
        Notification.requestPermission().then(async (result) => {
          if (result === "granted") {
            setIsPushGranted(true);

            // Reload to make sure page is in the correct state with new permissions
            location.reload();

            // Permission state *should* match "granted" after above operation, but we check again
            // for safety. This is necessary if the subscription request is elsewhere in your flow
            const pm = await registration?.pushManager?.permissionState();
            if (pm === "granted")
              // https://developer.mozilla.org/en-US/docs/Web/API/PushManager
              // Requires HTTPS and a valid service worker to receive push notifications
              registration?.pushManager
                .subscribe({
                  userVisibleOnly: true,
                  applicationServerKey: "HELLOWORLD",
                })
                .then(
                  (subscription) => {
                    setSubscription(subscription);
                    // This is the endpoint URL you're looking for
                    alert("Push endpoint:" + subscription.endpoint);
                    
                    // You should send this endpoint to your server and store it
                    // associated with the user's account
                    // sendEndpointToServer(subscription.endpoint);
                  },
                  (err) => alert(err)
                );
          } else {
            alert(
              "We weren't allowed to send you notifications. Permission state is: " +
                result
            );
          }
        });
      else {
        // Alert the user that they need to install the web page to use notifications
        alert("You need to install this web page to use notifications");
      }
    } catch (err) {
      alert(err);
    }
  };

  const setupPeriodicSync = async () => {
    alert("setupPeriodicSync");
    if (isAppInstalled) {
      if (
        "serviceWorker" in navigator &&
        "periodicSync" in navigator.serviceWorker
      ) {
        const registration = await navigator.serviceWorker.ready;
        if ("periodicSync" in registration) {
          try {
            const periodicSync = (registration as any).periodicSync;
            const tags = await periodicSync.getTags();
            if (!tags.includes("daily-sync")) {
              await periodicSync.register("daily-sync", {
                minInterval: 24 * 60 * 60 * 1000, // 1 day
              });
              alert("Daily sync registered");
              setIsPeriodicSyncEnabled(true);
            } else {
              alert("Daily sync already registered");
            }
          } catch (error) {
            alert("Error setting up periodic sync:" + error);
          }
        } else {
          alert("Periodic Sync API not available in registration");
        }
      } else {
        alert("Periodic Sync API not available in navigator");
      }
    } else {
      alert("You need to install the app to setup periodic sync");
    }
  };

  const cancelPeriodicSync = async () => {
    if (isAppInstalled) {
      if (
        "serviceWorker" in navigator &&
        "periodicSync" in navigator.serviceWorker
      ) {
        const registration = await navigator.serviceWorker.ready;
        if ("periodicSync" in registration) {
          try {
            const periodicSync = (registration as any).periodicSync;
            const tags = await periodicSync.getTags();
            if (tags.includes("daily-sync")) {
              await periodicSync.unregister("daily-sync");
              alert("Daily sync unregistered");
              setIsPeriodicSyncEnabled(false);
            } else {
              alert("No daily sync to cancel");
            }
          } catch (error) {
            alert("Error canceling periodic sync:" + error);
          }
        }
      }
    } else {
      alert("You need to install the app to cancel periodic sync");
    }
  };

  const triggerPeriodicSync = async () => {
    if (isAppInstalled && registration) {
      try {
        const periodicSync = (registration as any).periodicSync;
        if (periodicSync) {
          await periodicSync.trigger('daily-sync');
          alert('Periodic sync triggered manually');
        } else {
          console.warn('Periodic Sync API not available');
        }
      } catch (error) {
        alert('Error triggering periodic sync:' + error);
      }
    } else {
      alert('App not installed or registration not available');
    }
  };

  const triggerNotificationFromClient = async () => {
    try {
      const response = await fetch('/api/trigger-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id }),
      });
      if (response.ok) {
        console.log('Notification triggered successfully');
      } else {
        console.error('Failed to trigger notification');
      }
    } catch (error) {
      console.error('Error triggering notification:', error);
    }
  };

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
        isPeriodicSyncEnabled,
        setupPeriodicSync,
        cancelPeriodicSync,
        triggerPeriodicSync,
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
