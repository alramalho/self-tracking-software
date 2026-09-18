import { Prisma } from "@tsw/prisma";

import { prisma } from "@/utils/prisma";

import {
  APPLE_HEALTH_PROVIDER,
  HEALTHKIT_MERGED_SOURCE,
  type AppleHealthStatus,
  type AppleHealthSyncBatch,
  type AppleHealthSyncCounts,
  type AppleHealthWorkoutInput,
  type AppleHealthWorkoutMetadata,
} from "./types";

function workoutStorage(workout: AppleHealthWorkoutInput) {
  const {
    elevationAscendedMeters,
    elevationDescendedMeters,
    workoutEffortScore,
    estimatedWorkoutEffortScore,
    averageHeartRateBpm,
    maximumHeartRateBpm,
    heartRateZones,
    heartRateSeries,
    elevationProfile,
    route,
    ...fields
  } = workout;
  const metadata: AppleHealthWorkoutMetadata = {
    ...(elevationAscendedMeters == null ? {} : { elevationAscendedMeters }),
    ...(elevationDescendedMeters == null ? {} : { elevationDescendedMeters }),
    ...(workoutEffortScore == null ? {} : { workoutEffortScore }),
    ...(estimatedWorkoutEffortScore == null
      ? {}
      : { estimatedWorkoutEffortScore }),
    ...(averageHeartRateBpm == null ? {} : { averageHeartRateBpm }),
    ...(maximumHeartRateBpm == null ? {} : { maximumHeartRateBpm }),
    ...(heartRateZones == null ? {} : { heartRateZones }),
    ...(heartRateSeries == null ? {} : { heartRateSeries }),
    ...(elevationProfile == null ? {} : { elevationProfile }),
    ...(route == null ? {} : { route }),
  };
  return {
    fields,
    metadata:
      Object.keys(metadata).length > 0
        ? (metadata as Prisma.InputJsonObject)
        : Prisma.JsonNull,
  };
}

export async function getAppleHealthStatus(
  userId: string,
): Promise<AppleHealthStatus> {
  const providerFilter = {
    userId,
    provider: APPLE_HEALTH_PROVIDER,
  };
  const [
    integration,
    workoutStats,
    sleepSampleCount,
    sleepDayCount,
    dailyMetricCount,
    signalTypes,
    dailyMetricDateBounds,
  ] = await Promise.all([
    prisma.healthIntegration.findFirst({
      where: {
        ...providerFilter,
        disconnectedAt: null,
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.healthWorkout.aggregate({
      where: {
        ...providerFilter,
        deletedAt: null,
      },
      _count: { _all: true },
      _min: { startAt: true },
      _max: { endAt: true },
    }),
    prisma.healthSleepSample.count({
      where: {
        ...providerFilter,
        deletedAt: null,
      },
    }),
    prisma.healthDailyMetric.count({
      where: {
        ...providerFilter,
        metric: "sleep_asleep",
      },
    }),
    prisma.healthDailyMetric.count({ where: providerFilter }),
    prisma.healthDailyMetric.groupBy({
      by: ["metric"],
      where: providerFilter,
    }),
    prisma.healthDailyMetric.aggregate({
      where: providerFilter,
      _min: { localDate: true },
      _max: { localDate: true },
    }),
  ]);

  const workoutStartDate = workoutStats._min.startAt
    ?.toISOString()
    .slice(0, 10);
  const workoutEndDate = workoutStats._max.endAt?.toISOString().slice(0, 10);
  const startDates = [
    dailyMetricDateBounds._min.localDate,
    workoutStartDate,
  ].filter((value): value is string => Boolean(value));
  const endDates = [
    dailyMetricDateBounds._max.localDate,
    workoutEndDate,
  ].filter((value): value is string => Boolean(value));

  return {
    connected: Boolean(integration),
    requestedDataTypes: integration?.requestedDataTypes ?? [],
    initialSyncStartAt: integration?.initialSyncStartAt ?? null,
    lastSyncStartedAt: integration?.lastSyncStartedAt ?? null,
    lastSyncCompletedAt: integration?.lastSyncCompletedAt ?? null,
    lastSyncErrorAt: integration?.lastSyncErrorAt ?? null,
    lastSyncError: integration?.lastSyncError ?? null,
    importStats: {
      workoutCount: workoutStats._count._all,
      sleepDayCount,
      sleepSampleCount,
      dailyMetricCount,
      signalTypeCount: signalTypes.length,
      dataStartDate: startDates.sort()[0] ?? null,
      dataEndDate: endDates.sort().at(-1) ?? null,
    },
  };
}

export async function syncAppleHealthBatch(
  userId: string,
  batch: AppleHealthSyncBatch,
): Promise<AppleHealthSyncCounts> {
  const now = new Date();

  return prisma.$transaction(async (transaction) => {
    const integration = await transaction.healthIntegration.upsert({
      where: {
        userId_provider_deviceId: {
          userId,
          provider: APPLE_HEALTH_PROVIDER,
          deviceId: batch.deviceId,
        },
      },
      create: {
        userId,
        provider: APPLE_HEALTH_PROVIDER,
        deviceId: batch.deviceId,
        requestedDataTypes: batch.requestedDataTypes,
        initialSyncStartAt: batch.initialSyncStartAt
          ? new Date(batch.initialSyncStartAt)
          : null,
        lastSyncStartedAt: new Date(batch.syncStartedAt),
        lastSyncCompletedAt: batch.isFinalBatch ? now : null,
      },
      update: {
        requestedDataTypes: batch.requestedDataTypes,
        disconnectedAt: null,
        lastSyncError: null,
        lastSyncErrorAt: null,
        ...(batch.initialSyncStartAt
          ? { initialSyncStartAt: new Date(batch.initialSyncStartAt) }
          : {}),
        ...(batch.isFirstBatch
          ? { lastSyncStartedAt: new Date(batch.syncStartedAt) }
          : {}),
        ...(batch.isFinalBatch ? { lastSyncCompletedAt: now } : {}),
      },
    });

    for (const metric of batch.dailyMetrics) {
      const sourceBundleId = metric.sourceBundleId ?? HEALTHKIT_MERGED_SOURCE;

      await transaction.healthDailyMetric.upsert({
        where: {
          userId_provider_localDate_metric_aggregation_sourceBundleId: {
            userId,
            provider: APPLE_HEALTH_PROVIDER,
            localDate: metric.localDate,
            metric: metric.metric,
            aggregation: metric.aggregation,
            sourceBundleId,
          },
        },
        create: {
          userId,
          integrationId: integration.id,
          provider: APPLE_HEALTH_PROVIDER,
          ...metric,
          sourceBundleId,
        },
        update: {
          integrationId: integration.id,
          value: metric.value,
          unit: metric.unit,
          sourceName: metric.sourceName ?? null,
          timezone: metric.timezone ?? null,
          sampleCount: metric.sampleCount ?? null,
        },
      });
    }

    for (const workout of batch.workouts) {
      const stored = workoutStorage(workout);
      await transaction.healthWorkout.upsert({
        where: {
          userId_provider_externalId: {
            userId,
            provider: APPLE_HEALTH_PROVIDER,
            externalId: workout.externalId,
          },
        },
        create: {
          userId,
          integrationId: integration.id,
          provider: APPLE_HEALTH_PROVIDER,
          ...stored.fields,
          metadata: stored.metadata,
          startAt: new Date(workout.startAt),
          endAt: new Date(workout.endAt),
        },
        update: {
          integrationId: integration.id,
          ...stored.fields,
          metadata: stored.metadata,
          startAt: new Date(workout.startAt),
          endAt: new Date(workout.endAt),
          deletedAt: null,
        },
      });
    }

    for (const sample of batch.sleepSamples) {
      await transaction.healthSleepSample.upsert({
        where: {
          userId_provider_externalId: {
            userId,
            provider: APPLE_HEALTH_PROVIDER,
            externalId: sample.externalId,
          },
        },
        create: {
          userId,
          integrationId: integration.id,
          provider: APPLE_HEALTH_PROVIDER,
          ...sample,
          startAt: new Date(sample.startAt),
          endAt: new Date(sample.endAt),
        },
        update: {
          integrationId: integration.id,
          ...sample,
          startAt: new Date(sample.startAt),
          endAt: new Date(sample.endAt),
          deletedAt: null,
        },
      });
    }

    const [deletedWorkouts, deletedSleepSamples] = await Promise.all([
      batch.deletedWorkoutIds.length === 0
        ? Promise.resolve({ count: 0 })
        : transaction.healthWorkout.updateMany({
            where: {
              userId,
              provider: APPLE_HEALTH_PROVIDER,
              externalId: { in: batch.deletedWorkoutIds },
            },
            data: { deletedAt: now },
          }),
      batch.deletedSleepSampleIds.length === 0
        ? Promise.resolve({ count: 0 })
        : transaction.healthSleepSample.updateMany({
            where: {
              userId,
              provider: APPLE_HEALTH_PROVIDER,
              externalId: { in: batch.deletedSleepSampleIds },
            },
            data: { deletedAt: now },
          }),
    ]);

    return {
      dailyMetrics: batch.dailyMetrics.length,
      workouts: batch.workouts.length,
      sleepSamples: batch.sleepSamples.length,
      deletedWorkouts: deletedWorkouts.count,
      deletedSleepSamples: deletedSleepSamples.count,
    };
  });
}

export async function markAppleHealthSyncFailed(
  userId: string,
  deviceId: string,
  error: unknown,
): Promise<void> {
  const message =
    error instanceof Error ? error.message.slice(0, 500) : "Unknown sync error";

  await prisma.healthIntegration.updateMany({
    where: {
      userId,
      provider: APPLE_HEALTH_PROVIDER,
      deviceId,
    },
    data: {
      lastSyncErrorAt: new Date(),
      lastSyncError: message,
    },
  });
}

export async function disconnectAppleHealth(
  userId: string,
  deleteImportedData: boolean,
): Promise<void> {
  if (!deleteImportedData) {
    await prisma.healthIntegration.updateMany({
      where: {
        userId,
        provider: APPLE_HEALTH_PROVIDER,
        disconnectedAt: null,
      },
      data: { disconnectedAt: new Date() },
    });
    return;
  }

  await prisma.$transaction(async (transaction) => {
    const importedEntries = await transaction.healthWorkoutReconciliation.findMany({
      where: {
        userId,
        action: "import_new",
        activityEntry: { source: APPLE_HEALTH_PROVIDER },
      },
      select: {
        activityEntryId: true,
        createdActivity: true,
        activityEntry: { select: { activityId: true } },
      },
    });
    const importedEntryIds = importedEntries
      .map((entry) => entry.activityEntryId)
      .filter((entryId): entryId is string => Boolean(entryId));
    const createdActivityIds = importedEntries
      .filter((entry) => entry.createdActivity)
      .map((entry) => entry.activityEntry?.activityId)
      .filter((activityId): activityId is string => Boolean(activityId));

    if (importedEntryIds.length > 0) {
      await transaction.activityEntry.deleteMany({
        where: {
          id: { in: importedEntryIds },
          userId,
          source: APPLE_HEALTH_PROVIDER,
        },
      });
    }
    if (createdActivityIds.length > 0) {
      await transaction.activity.deleteMany({
        where: {
          id: { in: createdActivityIds },
          userId,
          entries: { none: {} },
          planSessions: { none: {} },
          plans: { none: {} },
        },
      });
    }
    await transaction.healthDailyMetric.deleteMany({
      where: { userId, provider: APPLE_HEALTH_PROVIDER },
    });
    await transaction.healthWorkout.deleteMany({
      where: { userId, provider: APPLE_HEALTH_PROVIDER },
    });
    await transaction.healthSleepSample.deleteMany({
      where: { userId, provider: APPLE_HEALTH_PROVIDER },
    });
    await transaction.healthIntegration.deleteMany({
      where: { userId, provider: APPLE_HEALTH_PROVIDER },
    });
  });
}
