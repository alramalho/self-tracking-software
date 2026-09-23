import type { HealthWorkoutPreview } from "../../src/features/health/workout-types";

export interface TimedDistancePoint {
  elapsedSeconds: number;
  distanceMeters: number;
}

export interface ComparisonWorkoutPreview extends HealthWorkoutPreview {
  distanceTimeSeries?: TimedDistancePoint[] | null;
}

export interface ComparisonWorkout {
  preview: ComparisonWorkoutPreview;
  profileAge: number | null;
}
