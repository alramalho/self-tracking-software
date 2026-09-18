import type { ReactNode } from "react";
import type { SleepScore } from "../sleep-types";

export interface NightStripProps {
  scores: SleepScore[];
  selectedDate?: string;
  onSelect: (date: string) => void;
}

export interface SleepBreakdownProps {
  score: SleepScore;
}

export interface SleepComponentRow {
  label: string;
  value: string;
  detail: string;
  /** Points earned for this component, or null while it is still being learned. */
  earned: number | null;
  /** Fixed point budget for this component, used as the bar's full scale. */
  maximum: number;
}

export interface SleepNavigationRowProps {
  label: string;
  detail?: string;
  leading?: ReactNode;
  onPress: () => void;
}
