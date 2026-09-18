import { useQuery } from "@tanstack/react-query";
import { api } from "@/data/api";
import { useHealth } from "./HealthProvider";
import type { WorkoutReconciliationPreview } from "./workout-types";
import {
  SLEEP_RANGE_DAYS,
  type SleepRange,
  type SleepScoresResponse,
} from "./sleep-types";
import type { HealthDailyMetricsResponse } from "./daily-types";

export function useHealthDailyMetrics() {
  const health = useHealth();
  return useQuery({
    queryKey: ["health", "daily-metrics"],
    enabled:
      !!health.status?.connected ||
      !!health.status?.importStats.dailyMetricCount ||
      !!health.garmin.status?.connected ||
      !!health.garmin.status?.importStats.dailyMetricCount,
    queryFn: async () => {
      const results = await Promise.allSettled([
        api.get<HealthDailyMetricsResponse>(
          "/health/apple/daily-metrics?days=14",
        ),
        api.get<HealthDailyMetricsResponse>(
          "/health/garmin/daily-metrics?days=14",
        ),
      ]);
      const responses = results.flatMap((result) =>
        result.status === "fulfilled" ? (result.value.data.metrics ?? []) : [],
      );
      if (
        !responses.length &&
        results.every((result) => result.status === "rejected")
      ) {
        throw results[0].status === "rejected"
          ? results[0].reason
          : new Error("Health metrics are unavailable");
      }
      return { metrics: responses };
    },
  });
}

export function useHealthWorkouts() {
  const health = useHealth();
  return useQuery({
    queryKey: ["health", "workouts"],
    enabled:
      !!health.status?.connected ||
      !!health.garmin.status?.connected ||
      !!health.garmin.status?.importStats.workoutCount,
    queryFn: async () =>
      (
        await api.get<WorkoutReconciliationPreview>(
          "/health/apple/workouts/reconciliation-preview",
        )
      ).data,
  });
}
export function useSleepScores(range: SleepRange = "7D") {
  const health = useHealth();
  const days = SLEEP_RANGE_DAYS[range];
  return useQuery({
    queryKey: ["health", "sleep", range],
    enabled:
      !!health.status?.connected ||
      !!health.status?.importStats.sleepSampleCount ||
      !!health.garmin.status?.connected ||
      !!health.garmin.status?.importStats.sleepSampleCount,
    queryFn: async () => {
      const results = await Promise.allSettled([
        api.get<SleepScoresResponse>(`/health/apple/sleep?days=${days}`),
        api.get<SleepScoresResponse>(`/health/garmin/sleep?days=${days}`),
      ]);
      // Keep the date union when someone has changed devices. Apple Health is
      // the preferred source for an overlapping date because it is the local
      // device's current record; Garmin-only history remains intact.
      const scoresByDate = new Map<
        string,
        SleepScoresResponse["scores"][number]
      >();
      for (const result of results) {
        if (result.status !== "fulfilled") continue;
        for (const score of result.value.data.scores) {
          if (!scoresByDate.has(score.date))
            scoresByDate.set(score.date, score);
        }
      }
      if (
        !scoresByDate.size &&
        results.every((result) => result.status === "rejected")
      ) {
        throw results[0].status === "rejected"
          ? results[0].reason
          : new Error("Sleep scores are unavailable");
      }
      return {
        metric: "sleep_score",
        name: "Sleep score",
        scale: 100,
        algorithm: "tracking-sleep-v0",
        scores: [...scoresByDate.values()].sort((a, b) =>
          b.date.localeCompare(a.date),
        ),
      } satisfies SleepScoresResponse;
    },
    placeholderData: (previous) => previous,
  });
}
