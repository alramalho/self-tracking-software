/* eslint-disable react-refresh/only-export-components */

"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import React from "react";
import toast from "react-hot-toast";
import { ActivitiesProvider } from "./activities/provider";
import { MetricsProvider } from "./metrics";
import { DataNotificationsProvider } from "./notifications";
import { PlansProvider } from "./plans";
import { PlansProgressProvider } from "./plans-progress";
import { RecommendationsProvider } from "./recommendations";
import { TimelineProvider } from "./timeline";
import { UsersProvider } from "./users";

interface GlobalDataProviderProps {
  children: React.ReactNode;
}

// Global data operations that work across contexts
export const useGlobalDataOperations = () => {
  const queryClient = useQueryClient();
  const router = useRouter();

  const refetchAllData = async (
    options: { preloadPages?: boolean; notify?: boolean } = {}
  ) => {
    const { preloadPages = false, notify = true } = options;
    try {
      await Promise.all([
        localStorage.removeItem("TRACKING_SO_QUERY_CACHE"),
        // can we force a page rerender?
        window.location.reload(),
      ]);

      const userData = await queryClient.refetchQueries({
        queryKey: ["userData", "current"],
      });

      // Preload navigation pages if requested
      if (preloadPages) {
        const routes = ["/", "/plans", "/add"];

        routes.forEach((route) => {
          router.preloadRoute({ to: route });
        });
      }

      if (notify) {
        toast.success("Data refreshed!");
      }

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
              <PlansProgressProvider>
                <ActivitiesProvider>
                  <RecommendationsProvider>{children}</RecommendationsProvider>
                </ActivitiesProvider>
              </PlansProgressProvider>
            </PlansProvider>
          </TimelineProvider>
        </MetricsProvider>
      </DataNotificationsProvider>
    </UsersProvider>
  );
};
