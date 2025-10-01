
"use client";

import { useApiWithAuth } from "@/api";
import { normalizeApiResponse } from "@/utils/dateUtils";
import { useSession } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import type { Activity } from "@tsw/prisma";
import React from "react";
import { getTimelineData, type TimelineActivityEntry, type TimelineUser } from "./service";
import { TimelineContext, type TimelineContextType } from "./types";

export const TimelineProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isSignedIn, isLoaded } = useSession();
  const api = useApiWithAuth();

  const timelineQuery = useQuery({
    queryKey: ["timeline"],
    queryFn: () => getTimelineData(api),
    select: (data) => ({
      recommendedActivityEntries: data.recommendedActivityEntries.map(entry =>
        normalizeApiResponse<TimelineActivityEntry>(entry, [
          "date",
          "createdAt",
          "updatedAt",
          "deletedAt",
          "comments.createdAt",
          "comments.deletedAt",
          "reactions.createdAt",
        ])
      ),
      recommendedActivities: data.recommendedActivities.map(activity =>
        normalizeApiResponse<Activity>(activity, [
          "createdAt",
          "updatedAt",
          "deletedAt",
        ])
      ),
      recommendedUsers: data.recommendedUsers.map(user =>
        normalizeApiResponse<TimelineUser>(user, [
          "plans.createdAt",
          "plans.updatedAt",
          "plans.finishingDate",
        ])
      ),
    }),
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
