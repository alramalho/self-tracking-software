import type { DistanceTimePoint } from "../workout-types";

export interface SplitWorkout {
  startAt: string;
  endAt: string;
  durationSeconds: number;
  distanceMeters: number | null;
  distanceTimeSeries?: DistanceTimePoint[] | null;
}

export interface KilometreSplit {
  number: number;
  startMeters: number;
  endMeters: number;
  distanceMeters: number;
  elapsedSeconds: number;
  paceSecondsPerKm: number;
  partial: boolean;
}
