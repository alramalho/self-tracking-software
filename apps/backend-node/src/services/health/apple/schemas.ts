import { z } from "zod/v4";

import {
  APPLE_HEALTH_AGGREGATIONS,
  APPLE_HEALTH_DAILY_METRICS,
} from "./types";

const nonEmptyBoundedString = z.string().trim().min(1).max(200);
const optionalBoundedString = nonEmptyBoundedString.optional();
const isoDateTime = z.string().datetime({ offset: true });
const localDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return (
      !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)
    );
  }, "Invalid calendar date");

const provenanceSchema = z.object({
  sourceBundleId: nonEmptyBoundedString,
  sourceName: optionalBoundedString,
  sourceProductType: optionalBoundedString,
  deviceName: optionalBoundedString,
  deviceModel: optionalBoundedString,
  timezone: optionalBoundedString,
});

const dailyMetricSchema = z.object({
  localDate,
  metric: z.enum(APPLE_HEALTH_DAILY_METRICS),
  aggregation: z.enum(APPLE_HEALTH_AGGREGATIONS),
  value: z.number().finite(),
  unit: z.string().trim().min(1).max(40),
  sourceBundleId: nonEmptyBoundedString.optional(),
  sourceName: optionalBoundedString,
  timezone: optionalBoundedString,
  sampleCount: z.number().int().nonnegative().max(10_000_000).optional(),
});

const heartRateZonesSchema = z.object({
  estimatedMaxHeartRateBpm: z.number().finite().positive().max(300),
  source: z.enum(["age_estimate", "default"]),
  zone1Seconds: z.number().finite().nonnegative(),
  zone2Seconds: z.number().finite().nonnegative(),
  zone3Seconds: z.number().finite().nonnegative(),
  zone4Seconds: z.number().finite().nonnegative(),
  zone5Seconds: z.number().finite().nonnegative(),
});

const elevationProfileSchema = z
  .array(
    z.object({
      distanceMeters: z.number().finite().nonnegative(),
      elevationMeters: z.number().finite(),
    }),
  )
  .min(2)
  .max(240);

const heartRateSeriesSchema = z
  .array(
    z.object({
      elapsedSeconds: z.number().finite().nonnegative(),
      bpm: z.number().finite().positive().max(300),
    }),
  )
  .min(2)
  .max(240);

const distanceTimeSeriesSchema = z
  .array(z.object({
    elapsedSeconds: z.number().finite().nonnegative(),
    distanceMeters: z.number().finite().nonnegative(),
  }))
  .min(2)
  .max(240);

const routeSchema = z
  .array(
    z.object({
      latitude: z.number().finite().min(-90).max(90),
      longitude: z.number().finite().min(-180).max(180),
      distanceMeters: z.number().finite().nonnegative(),
      elevationMeters: z.number().finite().optional(),
    }),
  )
  .min(2)
  .max(240);

const workoutSchema = provenanceSchema.extend({
  externalId: nonEmptyBoundedString,
  activityTypeCode: z.number().int().nonnegative(),
  activityTypeName: nonEmptyBoundedString,
  startAt: isoDateTime,
  endAt: isoDateTime,
  durationSeconds: z.number().finite().nonnegative(),
  activeEnergyKcal: z.number().finite().nonnegative().optional(),
  distanceMeters: z.number().finite().nonnegative().optional(),
  elevationAscendedMeters: z.number().finite().nonnegative().optional(),
  elevationDescendedMeters: z.number().finite().nonnegative().optional(),
  workoutEffortScore: z.number().finite().min(1).max(10).optional(),
  estimatedWorkoutEffortScore: z.number().finite().min(1).max(10).optional(),
  averageHeartRateBpm: z.number().finite().positive().max(300).optional(),
  maximumHeartRateBpm: z.number().finite().positive().max(300).optional(),
  heartRateZones: heartRateZonesSchema.optional(),
  heartRateSeries: heartRateSeriesSchema.optional(),
  distanceTimeSeries: distanceTimeSeriesSchema.optional(),
  elevationProfile: elevationProfileSchema.optional(),
  route: routeSchema.optional(),
});

const sleepSampleSchema = provenanceSchema.extend({
  externalId: nonEmptyBoundedString,
  stageCode: z.number().int().nonnegative(),
  stage: z.enum([
    "in_bed",
    "awake",
    "asleep_unspecified",
    "asleep_core",
    "asleep_deep",
    "asleep_rem",
  ]),
  startAt: isoDateTime,
  endAt: isoDateTime,
});

export const appleHealthSyncBatchSchema = z
  .object({
    deviceId: nonEmptyBoundedString,
    requestedDataTypes: z.array(nonEmptyBoundedString).max(50),
    initialSyncStartAt: isoDateTime.optional(),
    syncStartedAt: isoDateTime,
    isFirstBatch: z.boolean(),
    isFinalBatch: z.boolean(),
    dailyMetrics: z.array(dailyMetricSchema).max(250).default([]),
    workouts: z.array(workoutSchema).max(250).default([]),
    sleepSamples: z.array(sleepSampleSchema).max(250).default([]),
    deletedWorkoutIds: z.array(nonEmptyBoundedString).max(500).default([]),
    deletedSleepSampleIds: z.array(nonEmptyBoundedString).max(500).default([]),
  })
  .superRefine((batch, context) => {
    for (const [index, workout] of batch.workouts.entries()) {
      if (new Date(workout.endAt) < new Date(workout.startAt)) {
        context.addIssue({
          code: "custom",
          path: ["workouts", index, "endAt"],
          message: "Workout endAt must not be before startAt",
        });
      }
    }

    for (const [index, sample] of batch.sleepSamples.entries()) {
      if (new Date(sample.endAt) <= new Date(sample.startAt)) {
        context.addIssue({
          code: "custom",
          path: ["sleepSamples", index, "endAt"],
          message: "Sleep sample endAt must be after startAt",
        });
      }
    }
  });
