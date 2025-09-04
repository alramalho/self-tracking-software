"use client";

import { useQueryClient } from "@tanstack/react-query";
import React from "react";
import { ActivitiesProvider } from "./activities";
import { MetricsProvider } from "./metrics";
import {
  DataNotificationsProvider
} from "./notifications";
import { PlansProvider } from "./plans";
import { RecommendationsProvider } from "./recommendations";
import { TimelineProvider } from "./timeline";
import { UsersProvider } from "./users";

interface GlobalDataProviderProps {
  children: React.ReactNode;
}

// Global data operations that work across contexts
export const useGlobalDataOperations = () => {
  const queryClient = useQueryClient();

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

      const userData = await queryClient.refetchQueries({
        queryKey: ["userData", "current"],
      });
      return userData;
    } catch (err) {
      console.error("Failed to refresh all data:", err);
      throw err;
    }
  };


  return {
    refetchAllData,
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
                <RecommendationsProvider>{children}</RecommendationsProvider>
              </ActivitiesProvider>
            </PlansProvider>
          </TimelineProvider>
        </MetricsProvider>
      </DataNotificationsProvider>
    </UsersProvider>
  );
};
