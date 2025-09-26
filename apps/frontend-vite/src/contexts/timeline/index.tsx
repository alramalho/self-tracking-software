
"use client";

import { useApiWithAuth } from "@/api";
import { useSession } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { getTimelineData } from "./service";
import { TimelineContext, type TimelineContextType } from "./types";

export const TimelineProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isSignedIn, isLoaded } = useSession();
  const api = useApiWithAuth();

  const timelineQuery = useQuery({
    queryKey: ["timeline"],
    queryFn: () => getTimelineData(api),
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
