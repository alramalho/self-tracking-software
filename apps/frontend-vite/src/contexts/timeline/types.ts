import { createContext } from "react";
import type { TimelineData } from "./service";

export interface TimelineContextType {
  timelineData: TimelineData | undefined;
  timelineError: Error | null;
  isLoadingTimeline: boolean;
  isFetchingNextTimelinePage: boolean;
  isFetchNextTimelinePageError: boolean;
  hasMoreTimeline: boolean;
  fetchNextTimelinePage: () => Promise<unknown>;
}

export const TimelineContext = createContext<TimelineContextType | undefined>(
  undefined
);
