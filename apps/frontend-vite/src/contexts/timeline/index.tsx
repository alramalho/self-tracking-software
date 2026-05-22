
"use client";

import { useApiWithAuth } from "@/api";
import { useSession } from "@/contexts/auth";
import { useInfiniteQuery } from "@tanstack/react-query";
import React, { useMemo } from "react";
import { getTimelineData, type TimelineData } from "./service";
import { TimelineContext, type TimelineContextType } from "./types";

export const getTimelineNextPageParam = (
  lastPage: TimelineData,
  allPages: TimelineData[]
) => {
  const nextCursor = lastPage.nextCursor || undefined;
  if (!nextCursor) return undefined;

  const returnedItems =
    lastPage.recommendedActivityEntries.length + lastPage.achievementPosts.length;
  if (returnedItems === 0) return undefined;

  const previousPages = allPages.slice(0, -1);
  if (previousPages.some((page) => page.nextCursor === nextCursor)) {
    return undefined;
  }

  return nextCursor;
};

export const TimelineProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isSignedIn, isLoaded } = useSession();
  const api = useApiWithAuth();

  const timelineQuery = useInfiniteQuery({
    queryKey: ["timeline"],
    queryFn: ({ pageParam }) => getTimelineData(api, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: getTimelineNextPageParam,
    enabled: isLoaded && isSignedIn,
  });

  const timelineData = useMemo<TimelineData | undefined>(() => {
    if (!timelineQuery.data?.pages.length) return undefined;

    const activityMap = new Map<string, TimelineData["recommendedActivities"][number]>();
    const userMap = new Map<string, TimelineData["recommendedUsers"][number]>();

    timelineQuery.data.pages.forEach((page) => {
      page.recommendedActivities.forEach((activity) => activityMap.set(activity.id, activity));
      page.recommendedUsers.forEach((user) => userMap.set(user.id, user));
    });

    return {
      recommendedActivityEntries: timelineQuery.data.pages.flatMap(
        (page) => page.recommendedActivityEntries
      ),
      recommendedActivities: Array.from(activityMap.values()),
      recommendedUsers: Array.from(userMap.values()),
      achievementPosts: timelineQuery.data.pages.flatMap(
        (page) => page.achievementPosts
      ),
      nextCursor:
        timelineQuery.data.pages[timelineQuery.data.pages.length - 1]
          ?.nextCursor ?? null,
    };
  }, [timelineQuery.data]);

  const context: TimelineContextType = {
    timelineData,
    isLoadingTimeline: timelineQuery.isLoading,
    timelineError: timelineQuery.error,
    isFetchingNextTimelinePage: timelineQuery.isFetchingNextPage,
    isFetchNextTimelinePageError: timelineQuery.isFetchNextPageError,
    hasMoreTimeline: timelineQuery.hasNextPage,
    fetchNextTimelinePage: timelineQuery.fetchNextPage,
  };

  return (
    <TimelineContext.Provider value={context}>
      {children}
    </TimelineContext.Provider>
  );
};
