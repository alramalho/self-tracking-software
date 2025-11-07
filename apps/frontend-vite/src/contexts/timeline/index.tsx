
"use client";

import { useApiWithAuth } from "@/api";
import { useSession } from "@/contexts/auth";
import { normalizeApiResponse } from "@/utils/dateUtils";
import { useQuery } from "@tanstack/react-query";
import type { Activity } from "@tsw/prisma";
import React from "react";
import { getTimelineData, type TimelineAchievementPost, type TimelineActivityEntry, type TimelineUser } from "./service";
import { TimelineContext, type TimelineContextType } from "./types";
import { normalizePlanProgress } from "../plans-progress/service";

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
      recommendedUsers: data.recommendedUsers.map(user => ({
        ...normalizeApiResponse<TimelineUser>(user, [
          "plans.createdAt",
          "plans.updatedAt",
          "plans.finishingDate",
        ]),
        plans: user.plans.map(plan => ({
          ...plan,
          progress: normalizePlanProgress(plan.progress)
        }))
      })),
      achievementPosts: data.achievementPosts.map(achievementPost =>
        normalizeApiResponse<TimelineAchievementPost>(achievementPost, [
          "createdAt",
          "updatedAt",
          "deletedAt",
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
