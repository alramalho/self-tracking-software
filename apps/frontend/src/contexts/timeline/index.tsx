"use client";

import { useApiWithAuth } from "@/api";
import { useSession } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import React, { createContext, useContext } from "react";
import { getTimelineData, TimelineData } from "./service";

interface TimelineContextType {
  timelineData: TimelineData | undefined;
  isLoadingTimeline: boolean;
  timelineError: Error | null;
}

const TimelineContext = createContext<TimelineContextType | undefined>(undefined);

export const TimelineProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isSignedIn, isLoaded } = useSession();
  const api = useApiWithAuth();

  const timelineQuery = useQuery({
    queryKey: ["timeline"],
    queryFn: async() => {
      try {
        return await getTimelineData(api);
      } catch (error) {
        throw error;
      }
    },
    enabled: isLoaded && isSignedIn,
  });

  const context: TimelineContextType = {
    timelineData: timelineQuery.data,
    isLoadingTimeline: timelineQuery.isLoading,
    timelineError: timelineQuery.error,
  };

  return (
    <TimelineContext.Provider value={context}>
      {children}
    </TimelineContext.Provider>
  );
};

export const useTimeline = () => {
  const context = useContext(TimelineContext);
  if (context === undefined) {
    throw new Error("useTimeline must be used within a TimelineProvider");
  }
  return context;
};
