import type { HeartRateSeriesPoint, HeartRateZones } from "../workout-types";

export interface HeartRateChartProps {
  points: HeartRateSeriesPoint[] | null | undefined;
  startAt: string;
  endAt: string;
  zones?: HeartRateZones | null;
  age?: number | null;
  averageBpm?: number | null;
}

export type HeartRateZone = 1 | 2 | 3 | 4 | 5;

export interface HeartRateChartPoint extends HeartRateSeriesPoint {
  x: number;
  y: number;
}

export interface HeartRateChartSegment {
  from: HeartRateChartPoint;
  to: HeartRateChartPoint;
  zone: HeartRateZone | null;
}

export interface HeartRateChartModel {
  points: HeartRateChartPoint[];
  segments: HeartRateChartSegment[];
  minimumBpm: number;
  maximumBpm: number;
  elapsedSpanSeconds: number;
  maximumForZones: number | null;
  zoneSource: "workout_age_estimate" | "profile_age" | null;
  hasGaps: boolean;
}
