"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { isNotifySupported } from "@/app/swSupport";

interface NotificationsContextType {
  notificationCount: number;
  addNotifications: (count: number) => void;
  clearNotifications: () => void;
  sendNotification: (title:string, options: NotificationOptions) => void;
  requestPermission: () => Promise<void>;
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

  const [isPwaSupported, setIsPwaSupported] = useState(false);
  const [isPushGranted, setIsPushGranted] = useState(false);
  
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    // Check if all the features we want are available
    // In practice, it is better to check for each feature separately and allow users to opt-in 
    // to each feature on demand.
    const hasRequisite = isNotifySupported()
    setIsPwaSupported(hasRequisite);

    if (window.serwist !== undefined && hasRequisite) {
      try {
        setIsPushGranted(Notification.permission === "granted")
      } catch (err) {
        console.info(err)
      }

      const beforeinstallprompt = (event: any) => {
        console.log("Before install prompt: ", event);
      }

      const appinstalled = (event: any) => {
        console.log("App installed: ", event);
      }

      // Register the service worker
      window.serwist.register()
        .then((result: any) => setRegistration(result))
        .catch((err: any) => alert(err)).catch((err: Error) => console.warn(err))

      window.addEventListener("beforeinstallprompt", beforeinstallprompt);
      window.addEventListener("appinstalled", appinstalled);

      return () => {
        window.removeEventListener("beforeinstallprompt", beforeinstallprompt);
        window.removeEventListener("appinstalled", appinstalled);
      }
    } else {
      console.warn("Serwist is not available or the requisite features are not available")
    }
  }, []);

  useEffect(() => {
    console.info("Service worker registration state: ", registration?.active?.state)
    setIsAppInstalled(registration?.active?.state === "activated")
  }, [registration?.active?.state])

  useEffect(() => {
    navigator.setAppBadge && navigator.setAppBadge(notificationCount)
  }, [notificationCount])

  useEffect(() => {
    if ('serviceWorker' in navigator) {
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
      notifications.forEach(notification => notification.close());
    }
  };

  const sendNotification = async (title: string, options: NotificationOptions) => {
    if (registration) {
      await registration.showNotification(title, options);
      addNotifications(1);
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
            const pm = await registration?.pushManager?.permissionState()
            if (pm === "granted")
              // https://developer.mozilla.org/en-US/docs/Web/API/PushManager
              // Requires HTTPS and a valid service worker to receive push notifications
              registration?.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: "HELLOWORLD",
              }).then((subscription) => {
                console.log(subscription.endpoint);
                // The push subscription details needed by the application
                // server are now available, and can be sent to it using,
                // for example, the fetch() API.
              }, (err) => console.warn(err))
          } else {
            alert("We weren't allowed to send you notifications. Permission state is: " + result);
          }
        })
      else {
        // Alert the user that they need to install the web page to use notifications 
        alert('You need to install this web page to use notifications');
      }
    } catch (err) {
      console.log(err)
    }
  }

  return (
    <NotificationsContext.Provider
      value={{
        notificationCount,
        addNotifications,
        clearNotifications,
        sendNotification,
        requestPermission,
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
