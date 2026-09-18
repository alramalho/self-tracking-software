import type { WorkoutReconciliationDecision } from "../src/features/health/workout-types";

let active = false;
let batch = false;
let learning = false;
const resolved = new Set<string>();

// Scored nights are dated the same way as the seeded check-ins so the insights
// island can pair them, keeping the two fixtures consistent.
const nightOffset = (days: number) =>
  new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

const scoredNight = (days: number, total: number, awakenings: number) => ({
  date: nightOffset(days),
  total,
  asleepMinutes: 470 - total / 10,
  awakeMinutes: 9,
  awakenings,
  baselineNights: 13,
  durationPoints: 48,
  consistencyPoints: 28,
  interruptionPoints: 18,
  bedtimeDeviationMinutes: 14,
  status: "ready",
});

export function resetHealthFixture() {
  active = false;
  batch = false;
  learning = false;
  resolved.clear();
}
export function healthFixture(
  path: string,
  method: string,
  body: { decisions?: WorkoutReconciliationDecision[]; learning?: boolean },
) {
  if (path === "/__health" || path === "/__health-batch") {
    active = true;
    batch = path === "/__health-batch";
    learning = path === "/__health" && body.learning === true;
    resolved.clear();
    return { ok: true };
  }
  if (!path.startsWith("/health/apple")) return undefined;
  if (path.endsWith("/status"))
    return {
      connected: active,
      lastSyncCompletedAt: active ? "2026-09-15T08:00:00Z" : null,
      importStats: { sleepSampleCount: active ? 20 : 0 },
    };
  if (path.endsWith("/daily-metrics"))
    return {
      metrics: active
        ? [
            {
              localDate: "2026-09-14",
              metric: "resting_heart_rate",
              aggregation: "most_recent",
              value: 58,
              unit: "bpm",
              provider: "apple_health",
              sourceName: "Apple Watch",
            },
            {
              localDate: "2026-09-15",
              metric: "resting_heart_rate",
              aggregation: "most_recent",
              value: 56,
              unit: "bpm",
              provider: "apple_health",
              sourceName: "Apple Watch",
            },
            {
              localDate: "2026-09-14",
              metric: "heart_rate_variability_sdnn",
              aggregation: "average",
              value: 44,
              unit: "ms",
              provider: "apple_health",
              sourceName: "Apple Watch",
            },
            {
              localDate: "2026-09-15",
              metric: "heart_rate_variability_sdnn",
              aggregation: "average",
              value: 48,
              unit: "ms",
              provider: "apple_health",
              sourceName: "Apple Watch",
            },
          ]
        : [],
    };
  if (path.endsWith("/reconciliation-preview"))
    {
      const workouts = [
              {
                healthWorkout: {
                  id: "health-run",
                  displayName: "Running",
                  activityTypeName: "running",
                  startAt: "2026-09-15T07:00:00Z",
                  endAt: "2026-09-15T07:30:00Z",
                  durationSeconds: 1800,
                  distanceMeters: 5100,
                  effortScore: 6,
                  effortSource: "apple_estimated",
                  difficulty: "moderate",
                  averageHeartRateBpm: 151,
                  maximumHeartRateBpm: 184,
                  heartRateZones: {
                    estimatedMaxHeartRateBpm: 190,
                    source: "age_estimate",
                    zone1Seconds: 120,
                    zone2Seconds: 600,
                    zone3Seconds: 900,
                    zone4Seconds: 600,
                    zone5Seconds: 120,
                  },
                  heartRateSeries: [
                    { elapsedSeconds: 0, bpm: 132 },
                    { elapsedSeconds: 600, bpm: 168 },
                    { elapsedSeconds: 1200, bpm: 155 },
                    { elapsedSeconds: 1800, bpm: 181 },
                  ],
                  elevationAscendedMeters: 96,
                  elevationDescendedMeters: 91,
                  elevationProfile: [
                    { distanceMeters: 0, elevationMeters: 42 },
                    { distanceMeters: 1400, elevationMeters: 68 },
                    { distanceMeters: 3200, elevationMeters: 51 },
                    { distanceMeters: 5100, elevationMeters: 96 },
                  ],
                  route: [
                    { latitude: 38.7223, longitude: -9.1393, distanceMeters: 0 },
                    { latitude: 38.7231, longitude: -9.1384, distanceMeters: 1100, elevationMeters: 68 },
                    { latitude: 38.7224, longitude: -9.1375, distanceMeters: 2600, elevationMeters: 51 },
                    { latitude: 38.7240, longitude: -9.1368, distanceMeters: 5100, elevationMeters: 96 },
                  ],
                  sourceName: "Apple Watch",
                },
                category: "match",
                recommendedAction: null,
                resolved: null,
                mismatches: [
                  {
                    code: "value_mismatch",
                    severity: "conflict",
                    label: "Apple Health and tracking.so values differ",
                  },
                ],
                suggestedActivity: null,
                candidates: [
                  {
                    activityEntryId: "entry-run",
                    activityTitle: "Running",
                    activityMeasure: "kilometers",
                    quantity: 5,
                    datetime: "2026-09-15T07:30:00Z",
                    comparison: { compatible: true, healthValue: 5.1 },
                  },
                ],
              },
              ...(batch
                ? [
                    {
                      healthWorkout: {
                        id: "health-strength",
                        displayName: "Strength Training",
                        activityTypeName: "strength_training",
                        startAt: "2026-09-14T18:00:00Z",
                        endAt: "2026-09-14T18:40:00Z",
                        durationSeconds: 2400,
                        distanceMeters: null,
                        sourceName: "Apple Watch",
                      },
                      category: "match",
                      recommendedAction: "link_keep",
                      resolved: null,
                      mismatches: [],
                      suggestedActivity: null,
                      candidates: [
                        {
                          activityEntryId: "entry-strength",
                          activityTitle: "Gym",
                          activityEmoji: "🏋️",
                          activityMeasure: "minutes",
                          quantity: 40,
                          datetime: "2026-09-14T18:05:00Z",
                          comparison: {
                            compatible: true,
                            healthValue: 40,
                          },
                        },
                      ],
                    },
                  ]
                : []),
            ].filter((item) => !resolved.has(item.healthWorkout.id));
      return {
        summary: { pending: active ? workouts.length : 0 },
        items: active ? workouts : [],
      };
    }
  if (path.endsWith("/reconcile") && method === "POST") {
    for (const decision of body.decisions ?? [])
      resolved.add(decision.healthWorkoutId);
    return { applied: body.decisions?.length ?? 0 };
  }
  if (path.endsWith("/sleep"))
    return {
      scores: active
        ? learning
          ? [
              // Every night is still being learned: no total, but the duration
              // and interruption components were measured.
              { date: nightOffset(8), asleepMinutes: 380, awakeMinutes: 14, awakenings: 4, baselineNights: 2, durationPoints: 31, consistencyPoints: null, interruptionPoints: 13, status: "learning" },
              { date: nightOffset(9), asleepMinutes: 445, awakeMinutes: 8, awakenings: 1, baselineNights: 3, durationPoints: 40, consistencyPoints: null, interruptionPoints: 18, status: "learning" },
              { date: nightOffset(10), asleepMinutes: 420, awakeMinutes: 21, awakenings: 6, baselineNights: 4, durationPoints: 36, consistencyPoints: null, interruptionPoints: 9, status: "learning" },
              { date: nightOffset(11), asleepMinutes: 470, awakeMinutes: 6, awakenings: 1, baselineNights: 5, durationPoints: 47, consistencyPoints: null, interruptionPoints: 19, status: "learning" },
            ]
          : [
            {
              date: nightOffset(2),
              total: 91,
              asleepMinutes: 465,
              awakeMinutes: 12,
              awakenings: 3,
              baselineNights: 13,
              durationPoints: 47,
              consistencyPoints: 27,
              interruptionPoints: 17,
              bedtimeDeviationMinutes: 18,
              status: "ready",
            },
            {
              date: nightOffset(3),
              total: null,
              asleepMinutes: 380,
              awakeMinutes: 0,
              awakenings: 1,
              baselineNights: 6,
              status: "learning",
              durationPoints: 31,
              consistencyPoints: null,
              interruptionPoints: 20,
            },
            // Scored nights dated like the seeded check-ins so the insights
            // island can compare sleep quality with ratings.
            scoredNight(8, 95, 4),
            scoredNight(9, 45, 7),
            scoredNight(10, 55, 2),
            scoredNight(11, 66, 5),
            scoredNight(12, 85, 3),
            scoredNight(13, 92, 1),
          ]
        : [],
    };
  if (path === "/health/apple" && method === "DELETE") {
    active = false;
    return {};
  }
  if (path.endsWith("/sync")) {
    active = true;
    return { success: true };
  }
  return undefined;
}
