"use client";

import { useQueryClient } from "@tanstack/react-query";
import React from "react";
import { ActivitiesProvider } from "./activities";
import { MetricsProvider } from "./metrics";
import { DataNotificationsProvider, useDataNotifications } from "./notifications";
import { PlansProvider } from "./plans";
import { TimelineProvider, useTimeline } from "./timeline";
import { UsersProvider, useCurrentUser } from "./users";

interface GlobalDataProviderProps {
  children: React.ReactNode;
}

// Global data operations that work across contexts
export const useGlobalDataOperations = () => {
  const queryClient = useQueryClient();
  const { currentUser, isLoadingCurrentUser } = useCurrentUser();
  const { isLoadingTimeline } = useTimeline();
  const { isLoadingNotifications } = useDataNotifications();
  
  const refetchAllData = async () => {
    try {
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["userData"] }),
        queryClient.refetchQueries({ queryKey: ["timelineData"] }),
        queryClient.refetchQueries({ queryKey: ["notificationsData"] }),
        queryClient.refetchQueries({ queryKey: ["messagesData"] }),
        queryClient.refetchQueries({ queryKey: ["recommendedUsers"] }),
        queryClient.refetchQueries({ queryKey: ["multipleUsersData"] }),
        queryClient.refetchQueries({ queryKey: ["metricsAndEntries"] }),
      ]);
      
      const userData = await queryClient.refetchQueries({ queryKey: ["userData", "current"] });
      return userData;
    } catch (err) {
      console.error("Failed to refresh all data:", err);
      throw err;
    }
  };

  // Function to check if we have any cached query data
  const hasCacheData = () => {
    if (typeof window === "undefined") return false;
    try {
      const cachedData = localStorage.getItem("TRACKING_SO_QUERY_CACHE");
      if (!cachedData) return false;

      const parsedCache = JSON.parse(cachedData);
      const queries = parsedCache?.clientState?.queries;
      const mutations = parsedCache?.clientState?.mutations;
      return (
        (Array.isArray(queries) && queries.length > 0) ||
        (Array.isArray(mutations) && mutations.length > 0)
      );
    } catch (error) {
      console.warn("Error checking for cached user data:", error);
      return false;
    }
  };

  // Status calculation similar to original UserGlobalContext
  const isWaitingForData = 
    !hasCacheData() &&
    !isLoadingCurrentUser &&
    !isLoadingTimeline &&
    !isLoadingNotifications;

  return {
    refetchAllData,
    hasCacheData,
    isWaitingForData,
  };
};

export const GlobalDataProvider: React.FC<GlobalDataProviderProps> = ({
  children,
}) => {
  return (
    <UsersProvider>
      <DataNotificationsProvider>
        <MetricsProvider>
          <TimelineProvider>
            <PlansProvider>
              <ActivitiesProvider>
                {children}
              </ActivitiesProvider>
            </PlansProvider>
          </TimelineProvider>
        </MetricsProvider>
      </DataNotificationsProvider>
    </UsersProvider>
  );
};