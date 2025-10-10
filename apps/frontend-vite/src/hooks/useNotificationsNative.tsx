"use client";

import { useApiWithAuth } from "@/api";
import { useDataNotifications } from "@/contexts/notifications";
import { useCurrentUser } from "@/contexts/users";
import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications, type PushNotificationSchema, type Token } from '@capacitor/push-notifications';
import { Badge } from '@capawesome/capacitor-badge';
import { type Notification as PrismaNotification } from "@tsw/prisma";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState
} from "react";

interface NotificationsNativeContextType {
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

const NotificationsNativeContext = createContext<
  NotificationsNativeContextType | undefined
>(undefined);

export const NotificationsNativeProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const { notifications } = useDataNotifications();
  const { updateUser, currentUser } = useCurrentUser();
  const [notificationCount, setNotificationCount] = useState(0);
  const [isPushGranted, setIsPushGranted] = useState(false);
  const [deviceToken, setDeviceToken] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const api = useApiWithAuth();

  // Sync isPushGranted with database state
  useEffect(() => {
    if (currentUser?.isIosNotificationsEnabled !== undefined) {
      setIsPushGranted(currentUser.isIosNotificationsEnabled);
    }
  }, [currentUser?.isIosNotificationsEnabled]);

  // Native apps are always "installed"
  const isAppInstalled = true;

  // Update app badge based on notifications
  useEffect(() => {
    if (notifications) {
      const nonConcludedNotificationsCount = notifications.filter(
        (notification: PrismaNotification) => notification.status !== "CONCLUDED"
      ).length || 0;

      const totalBadgeCount = nonConcludedNotificationsCount;

      // Set badge count using Badge plugin
      Badge.set({ count: totalBadgeCount }).catch((err: Error) => {
        console.error("Error setting badge count:", err);
      });
    }
  }, [notifications]);

  // Define updateNativeStatus using useCallback
  const updateNativeStatus = useCallback(
    async (token: string) => {
      try {
        await updateUser({
          updates: {
            isIosNotificationsEnabled: true,
            iosDeviceToken: token,
            iosDeviceTokenUpdatedAt: new Date(),
          },
          muteNotifications: true,
        });
      } catch (error) {
        console.error("Failed to update native device token:", error);
      }
    },
    [updateUser]
  );

  const addToNotificationCount = useCallback((count: number) => {
    setNotificationCount(prev => prev + count);
  }, []);

  // Override setIsPushGranted to update database
  const handleSetIsPushGranted = useCallback(async (granted: boolean) => {
    setIsPushGranted(granted);
    try {
      await updateUser({
        updates: {
          isIosNotificationsEnabled: granted,
        },
        muteNotifications: true,
      });
    } catch (error) {
      console.error("Failed to update iOS notifications enabled status:", error);
    }
  }, [updateUser]);

  // Initialize push notifications
  useEffect(() => {
    if (isInitialized) return;

    const initializePushNotifications = async () => {
      try {
        // Check initial permission status
        const permStatus = await PushNotifications.checkPermissions();
        const granted = permStatus.receive === 'granted';
        setIsPushGranted(granted);

        // Add listeners for push notifications
        await PushNotifications.addListener('registration', (token: Token) => {
          setDeviceToken(token.value);
          updateNativeStatus(token.value);
        });

        await PushNotifications.addListener('registrationError', (error: any) => {
          console.error('Error on registration: ' + JSON.stringify(error));
        });

        await PushNotifications.addListener(
          'pushNotificationReceived',
          (notification: PushNotificationSchema) => {
            addToNotificationCount(1);
          },
        );

        await PushNotifications.addListener(
          'pushNotificationActionPerformed',
          (notification: any) => {
            // Handle notification tap/action here
            // You can navigate to specific URLs using notification.notification.data.url
          },
        );

        // If already granted, register immediately
        if (granted) {
          await PushNotifications.register();
        }

        setIsInitialized(true);
      } catch (error) {
        console.error("Error initializing push notifications:", error);
      }
    };

    initializePushNotifications();

    return () => {
      // Only cleanup listeners on unmount (when isInitialized is true and we're actually unmounting)
      // Not on re-renders caused by dependency changes
      if (isInitialized) {
        PushNotifications.removeAllListeners();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized]); // Only depend on isInitialized, not the callbacks

  const sendLocalNotification = async (
    title: string,
    body: string,
    icon?: string,
    url?: string
  ) => {
    try {
      // Check permission first
      const permStatus = await LocalNotifications.checkPermissions();

      if (permStatus.display !== 'granted') {
        const result = await LocalNotifications.requestPermissions();
        if (result.display !== 'granted') {
          console.warn("Local notification permission not granted");
          return;
        }
      }

      // Schedule notification immediately
      await LocalNotifications.schedule({
        notifications: [
          {
            title,
            body,
            id: Date.now(), // Use timestamp as unique ID
            extra: { url }, // Store URL in extra data for handling taps
            iconColor: icon, // iOS doesn't support custom icons, but we can use color
          }
        ]
      });

      addToNotificationCount(1);
    } catch (error) {
      console.error("Error sending local notification:", error);
    }
  };

  const requestPermission = async (): Promise<boolean | undefined> => {
    try {
      // Check current permission status
      let permStatus = await PushNotifications.checkPermissions();

      if (permStatus.receive !== 'granted') {
        permStatus = await PushNotifications.requestPermissions();
      }

      const granted = permStatus.receive === 'granted';

      await handleSetIsPushGranted(granted);

      if (granted) {
        // Register for push notifications
        await PushNotifications.register();
      }

      return granted;
    } catch (error) {
      console.error("Error requesting push permission:", error);
      return false;
    }
  };

  const sendPushNotification = async (
    title: string,
    body: string,
    icon?: string,
    url?: string
  ) => {
    try {
      // Send push notification via your backend
      // Backend will look up the device token from the database using the user's auth
      await api.post("/notifications/trigger-push-notification", {
        title,
        body,
        icon,
        url,
      });
    } catch (error) {
      console.error("Failed to send native push notification:", error);
    }
  };

  return (
    <NotificationsNativeContext.Provider
      value={{
        notificationCount,
        addToNotificationCount,
        sendLocalNotification,
        sendPushNotification,
        requestPermission,
        isAppInstalled,
        isPushGranted,
        setIsPushGranted: handleSetIsPushGranted,
      }}
    >
      {children}
    </NotificationsNativeContext.Provider>
  );
};

export const useNotificationsNative = (): NotificationsNativeContextType => {
  const context = useContext(NotificationsNativeContext);
  if (context === undefined) {
    throw new Error(
      "useNotificationsNative must be used within a NotificationsNativeProvider"
    );
  }
  return context;
};
