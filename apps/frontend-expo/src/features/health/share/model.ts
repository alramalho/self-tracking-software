import type { HealthWorkoutPreview, RoutePoint } from "../workout-types";
import type { WorkoutSharePalette, WorkoutShareStatsCount } from "./types";

export interface WorkoutShareStat {
  label: string;
  value: string;
}

export const SHARE_PALETTES: Array<{ id: WorkoutSharePalette; label: string; color: string }> = [
  { id: "sunset", label: "Sunset", color: "#ffb52e" },
  { id: "lime", label: "Lime", color: "#c8f23a" },
  { id: "violet", label: "Violet", color: "#bb8cff" },
  { id: "ice", label: "Ice", color: "#5bd7ff" },
];

export function formatWorkoutDuration(seconds: number) {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function formatWorkoutPace(workout: HealthWorkoutPreview) {
  if (!workout.distanceMeters || workout.distanceMeters < 100) return null;
  const secondsPerKm = workout.durationSeconds / (workout.distanceMeters / 1000);
  const roundedSeconds = Math.round(secondsPerKm);
  return `${Math.floor(roundedSeconds / 60)}:${String(roundedSeconds % 60).padStart(2, "0")} /km`;
}

export function workoutShareStats(workout: HealthWorkoutPreview): WorkoutShareStat[] {
  const stats: Array<WorkoutShareStat | null> = [
    workout.distanceMeters == null
      ? null
      : { label: "Distance", value: `${(workout.distanceMeters / 1000).toFixed(2)} km` },
    { label: "Time", value: formatWorkoutDuration(workout.durationSeconds) },
    formatWorkoutPace(workout) ? { label: "Pace", value: formatWorkoutPace(workout)! } : null,
    workout.elevationAscendedMeters == null
      ? null
      : { label: "Elevation", value: `${Math.round(workout.elevationAscendedMeters)} m` },
    workout.averageHeartRateBpm == null
      ? null
      : { label: "Avg heart rate", value: `${Math.round(workout.averageHeartRateBpm)} bpm` },
    workout.activeEnergyKcal == null
      ? null
      : { label: "Calories", value: `${Math.round(workout.activeEnergyKcal)} kcal` },
  ];
  return stats.filter((stat): stat is WorkoutShareStat => stat !== null);
}

export function shareRoutePoints(points: RoutePoint[], width: number, height: number, padding: number) {
  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLon = Math.min(...longitudes);
  const maxLon = Math.max(...longitudes);
  const latRange = Math.max(maxLat - minLat, 0.00001);
  const lonRange = Math.max(maxLon - minLon, 0.00001);
  return points.map((point) => ({
    x: padding + ((point.longitude - minLon) / lonRange) * (width - padding * 2),
    y: height - padding - ((point.latitude - minLat) / latRange) * (height - padding * 2),
  }));
}

export function paletteColor(palette: WorkoutSharePalette) {
  return SHARE_PALETTES.find((option) => option.id === palette)?.color ?? SHARE_PALETTES[0].color;
}

export function shareCanvasSize(statsCount: WorkoutShareStatsCount, orientation: "portrait" | "landscape") {
  const base = statsCount === 6 ? 430 : 360;
  return orientation === "portrait"
    ? { width: 360, height: base }
    : { width: 520, height: Math.max(300, base - 90) };
}
