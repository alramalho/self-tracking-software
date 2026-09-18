export interface SleepSample {
  id: string;
  stage: string;
  startAt: Date;
  endAt: Date;
  sourceBundleId: string;
  sourceName: string | null;
  sourceProductType?: string | null;
  timezone: string | null;
}
export interface SleepInterval {
  start: number;
  end: number;
  awake: boolean;
}
export interface SleepNight {
  date: string;
  startAt: string;
  endAt: string;
  timezone: string;
  sourceName: string;
  sourceBundleId: string;
  asleepMinutes: number;
  awakeMinutes: number;
  awakenings: number;
  bedtimeMinutes: number;
  coverage: number;
  continuityAvailable: boolean;
}
export interface SleepScore extends SleepNight {
  algorithm: "tracking-sleep-v0";
  targetMinutes: number;
  total: number | null;
  durationPoints: number;
  consistencyPoints: number | null;
  interruptionPoints: number | null;
  baselineNights: number;
  bedtimeDeviationMinutes: number | null;
  status: "ready" | "learning" | "incomplete";
}
export interface SleepScoresResponse {
  metric: "sleep_score";
  name: "Sleep score";
  scale: 100;
  algorithm: "tracking-sleep-v0";
  scores: SleepScore[];
}

export type SleepRange = "7D" | "1M" | "6M";

export const SLEEP_RANGES = ["7D", "1M", "6M"] as const satisfies SleepRange[];

export const SLEEP_RANGE_DAYS: Record<SleepRange, number> = {
  "7D": 7,
  "1M": 30,
  "6M": 180,
};
