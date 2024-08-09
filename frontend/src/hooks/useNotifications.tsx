"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

interface NotificationsContextType {
  notificationCount: number;
  addNotifications: (count: number) => void;
  clearNotifications: () => void;
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

  const addNotifications = (count: number) =>
    setNotificationCount((prev) => prev + count);
  const clearNotifications = () => setNotificationCount(0);

  return (
    <NotificationsContext.Provider
      value={{
        notificationCount,
        addNotifications,
        clearNotifications,
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
