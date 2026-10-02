import type {
  Activity,
  ActivityEntry,
  DateValue,
  PausePeriod,
  Plan,
} from "@/core/types";
import type { WeekOutcome } from "@tsw/prisma/follow-through/streak";
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
  /** One session short: the streak held (shown as a small faded flame). */
  held: boolean;
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
/** A past week in the streak explainer's "Your last weeks" strip. */
export interface StreakWeek {
  key: string;
  label: string;
  done: number;
  target: number;
  outcome: WeekOutcome;
}
/** One example week in the streak explainer: its dots and what the streak does. */
export interface StreakExample {
  outcome: WeekOutcome;
  change: string;
  title: string;
  detail: string;
  done: number;
  target: number;
}
export interface StreakExplainerProps {
  plan: Plan;
  onClose: () => void;
}
export interface HeatmapProps extends HeatmapInput {
  compact?: boolean;
  onEntryPress?: (entry: ActivityEntry) => void;
  onActivityPress?: (activity: Activity) => void;
  testID?: string;
}
