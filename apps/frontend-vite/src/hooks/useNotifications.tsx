/* eslint-disable react-refresh/only-export-components */
"use client";

import { Capacitor } from '@capacitor/core';
import { type ReactNode } from "react";
import {
  NotificationsWebProvider,
  useNotificationsWeb
} from "./useNotificationsWeb";
import {
  NotificationsNativeProvider,
  useNotificationsNative
} from "./useNotificationsNative";

export interface NotificationsContextType {
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

/**
 * Platform-adaptive NotificationsProvider
 * Uses native notifications on iOS via Capacitor
 * Uses web notifications (PWA) on web browsers
 */
export const NotificationsProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    return (
      <NotificationsNativeProvider>
        {children}
      </NotificationsNativeProvider>
    );
  }

  return (
    <NotificationsWebProvider>
      {children}
    </NotificationsWebProvider>
  );
};

/**
 * Platform-adaptive useNotifications hook
 * Automatically uses the correct implementation based on platform
 *
 * On iOS native: Uses Capacitor Push Notifications & Local Notifications
 * On Web/PWA: Uses Service Workers & Web Push API
 */
export const useNotifications = (): NotificationsContextType => {
  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useNotificationsNative();
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useNotificationsWeb();
};
