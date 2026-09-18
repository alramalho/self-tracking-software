import type {
  Activity,
  ActivityEntry,
  DateValue,
  PausePeriod,
  Plan,
} from "@/core/types";
export interface GridSegment {
  activity: Activity;
  intensity: number;
  entryId: string;
}
export interface GridDay {
  date: Date;
  key: string;
  entries: ActivityEntry[];
  segments: GridSegment[];
  paused: boolean;
  today: boolean;
}
export interface GridWeek {
  key: string;
  date: Date;
  days: GridDay[];
  completed: boolean;
}
export interface HeatmapInput {
  activities: Activity[];
  entries: ActivityEntry[];
  plan?: Plan;
  now?: Date;
  startDate?: DateValue;
  endDate?: DateValue;
  premium?: boolean;
}
export interface HeatmapModel {
  weeks: GridWeek[];
  historyLimited: boolean;
  startDate: Date;
  endDate: Date;
}
export interface HeatmapProps extends HeatmapInput {
  compact?: boolean;
  onEntryPress?: (entry: ActivityEntry) => void;
  onActivityPress?: (activity: Activity) => void;
  testID?: string;
}
