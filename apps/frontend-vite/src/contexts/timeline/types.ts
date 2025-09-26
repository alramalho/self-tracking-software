import { createContext } from "react";
import type { TimelineData } from "./service";

export interface TimelineContextType {
  timelineData: TimelineData | undefined;
  timelineError: Error | null;
  isLoadingTimeline: boolean;
}

export const TimelineContext = createContext<TimelineContextType | undefined>(
  undefined
);
