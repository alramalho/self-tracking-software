import { Prisma } from "@tsw/prisma";

import { logger } from "@/utils/logger";
import { prisma } from "@/utils/prisma";
import { updateSleepScoresForProvider } from "../apple/sleep/service";

import {
  decryptGarminSecret,
  deleteGarminUser,
  encryptGarminSecret,
  exchangeGarminToken,
  GarminApiError,
  getGarminJson,
  getGarminOAuthConfig,
  getGarminPermissions,
  getGarminUserId,
  GARMIN_AUTHORIZE_URL,
  hashGarminAccessToken,
  hashGarminRequestToken,
  requestGarminApiText,
  requestGarminBackfill,
  requestGarminToken,
  requireGarminOAuthConfig,
} from "./oauth";
import {
  GARMIN_HEALTH_PROVIDER,
  GARMIN_SOURCE,
  GARMIN_SOURCE_NAME,
  normalizeGarminSummary,
  payloadRecords,
  webhookRecord,
} from "./normalization";
import type {
  GarminAccessToken,
  GarminConnectStart,
  GarminImportStats,
  GarminNormalizedData,
  GarminOAuthConfig,
  GarminStatus,
  GarminSyncOptions,
  GarminSyncResult,
  GarminWebhookPayload,
  GarminWebhookRecord,
} from "./types";

const REQUEST_TOKEN_TTL_MS = 10 * 60 * 1000;
const DEFAULT_SYNC_DAYS = 14;
const INITIAL_BACKFILL_DAYS = 180;
const MAX_BACKFILL_DAYS = 180;
// Garmin rejected the larger ranges in the live Lia probe. Keep each request
// conservative and roll through multiple windows for the wider history.
const MAX_BACKFILL_WINDOW_DAYS = 30;
const MAX_PULL_WINDOW_SECONDS = 23 * 60 * 60;
const SYNC_OVERLAP_SECONDS = 2 * 24 * 60 * 60;
const GARMIN_DEVICE_PREFIX = "garmin:";
const SYNC_SUMMARY_TYPES = [
  "dailies",
  "sleeps",
  "activities",
  "manuallyUpdatedActivities",
  "hrv",
  "allDayRespiration",
  "pulseox",
  "stressDetails",
  "bodyComps",
  "userMetrics",
  "bloodPressures",
] as const;
const BACKFILL_SUMMARY_TYPES = [
  "dailies",
  "sleeps",
  "activities",
  "hrv",
] as const;
const WEBHOOK_SUMMARY_TYPES = [
  "dailies",
  "epochs",
  "sleeps",
  "activities",
  "manuallyUpdatedActivities",
  "activityDetails",
  "hrv",
  "allDayRespiration",
  "pulseox",
  "stressDetails",
  "bodyComps",
  "userMetrics",
  "bloodPressures",
] as const;

const syncLocks = new Set<string>();

const isAllowedGarminCallbackUrl = (
  callbackUrl: string,
  apiBaseUrl: string,
): boolean => {
  try {
    const url = new URL(callbackUrl);
    const configuredHost = new URL(apiBaseUrl).hostname;
    return (
      url.protocol === "https:" &&
      (url.hostname === configuredHost || url.hostname.endsWith(".garmin.com"))
    );
  } catch {
    return false;
  }
};

const asJson = (
  value: unknown,
): Prisma.InputJsonValue | Prisma.JsonNullValueInput =>
  value == null
    ? Prisma.JsonNull
    : (JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue);

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message.slice(0, 500) : "Unknown sync error";

const errorContext = (error: unknown): Record<string, unknown> => {
  if (error instanceof GarminApiError) {
    return {
      errorName: error.name,
      status: error.status,
      ...(error.endpoint ? { endpoint: error.endpoint } : {}),
      ...(error.responseBody ? { providerMessage: error.responseBody } : {}),
    };
  }
  return {
    errorName: error instanceof Error ? error.name : "UnknownError",
    errorMessage: errorMessage(error),
  };
};

const isIgnorableApiError = (error: unknown): boolean =>
  error instanceof GarminApiError &&
  [400, 403, 404, 405, 501].includes(error.status);

// Backfill is an optional accelerator for the initial import. Garmin may
// reject it when a project lacks a backfill permission or throttle repeated
// requests with 429, but neither case should prevent the normal pull endpoints
// below from importing the data that is already available.
const isIgnorableBackfillError = (error: unknown): boolean =>
  error instanceof GarminApiError &&
  [400, 403, 404, 405, 409, 429, 501].includes(error.status);

const backfillStatusForError = (
  error: unknown,
): "already_requested" | "rate_limited" | "unavailable" => {
  if (error instanceof GarminApiError && error.status === 409) {
    return "already_requested";
  }
  if (error instanceof GarminApiError && error.status === 429) {
    return "rate_limited";
  }
  return "unavailable";
};

const garminDeviceId = (garminUserId: string): string =>
  `${GARMIN_DEVICE_PREFIX}${garminUserId}`;

const requestedDataTypes = [...WEBHOOK_SUMMARY_TYPES];

async function refreshGarminPermissions(
  userId: string,
  config: GarminOAuthConfig,
  accessToken: GarminAccessToken,
): Promise<string[]> {
  try {
    const permissions = await getGarminPermissions(config, accessToken);
    await prisma.garminIntegration.updateMany({
      where: { userId, disconnectedAt: null },
      data: { permissions },
    });
    return permissions;
  } catch (error) {
    logger.warn("Garmin permissions refresh failed", {
      userId,
      status: error instanceof GarminApiError ? error.status : undefined,
    });
    return [];
  }
}

export const getGarminStatus = async (
  userId: string,
): Promise<GarminStatus> => {
  const providerFilter = { userId, provider: GARMIN_HEALTH_PROVIDER };
  const [
    integration,
    workoutStats,
    sleepSampleCount,
    sleepDayCount,
    dailyMetricCount,
    signalTypes,
    dateBounds,
  ] = await Promise.all([
    prisma.garminIntegration.findFirst({
      where: { userId, disconnectedAt: null },
      orderBy: { updatedAt: "desc" },
      select: {
        permissions: true,
        connectedAt: true,
        initialSyncStartedAt: true,
        backfillRequestedAt: true,
        backfillCursorSeconds: true,
        lastSyncStartedAt: true,
        lastSyncCompletedAt: true,
        lastSyncError: true,
      },
    }),
    prisma.healthWorkout.aggregate({
      where: { ...providerFilter, deletedAt: null },
      _count: { _all: true },
      _min: { startAt: true },
      _max: { endAt: true },
    }),
    prisma.healthSleepSample.count({
      where: { ...providerFilter, deletedAt: null },
    }),
    prisma.healthDailyMetric.count({
      where: { ...providerFilter, metric: "sleep_asleep" },
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
  const startDates = [dateBounds._min.localDate, workoutStartDate].filter(
    (value): value is string => Boolean(value),
  );
  const endDates = [dateBounds._max.localDate, workoutEndDate].filter(
    (value): value is string => Boolean(value),
  );
  const importStats: GarminImportStats = {
    workoutCount: workoutStats._count._all,
    sleepDayCount,
    sleepSampleCount,
    dailyMetricCount,
    signalTypeCount: signalTypes.length,
    dataStartDate: startDates.sort()[0] ?? null,
    dataEndDate: endDates.sort().at(-1) ?? null,
  };

  return {
    available: Boolean(getGarminOAuthConfig()),
    connected: Boolean(integration),
    permissions: integration?.permissions ?? [],
    connectedAt: integration?.connectedAt.toISOString() ?? null,
    initialSyncStartedAt:
      integration?.initialSyncStartedAt?.toISOString() ?? null,
    backfillRequestedAt:
      integration?.backfillRequestedAt?.toISOString() ?? null,
    backfillInProgress: integration?.backfillCursorSeconds != null,
    lastSyncStartedAt: integration?.lastSyncStartedAt?.toISOString() ?? null,
    lastSyncCompletedAt:
      integration?.lastSyncCompletedAt?.toISOString() ?? null,
    lastSyncError: integration?.lastSyncError ?? null,
    importStats,
  };
};

export const startGarminConnection = async (
  userId: string,
  returnUrl?: string,
): Promise<GarminConnectStart> => {
  const config = requireGarminOAuthConfig();
  const requestToken = await requestGarminToken(config);
  await prisma.garminOAuthRequest.deleteMany({ where: { userId } });
  await prisma.garminOAuthRequest.create({
    data: {
      userId,
      requestTokenHash: hashGarminRequestToken(requestToken.token),
      requestTokenSecretEncrypted: encryptGarminSecret(
        requestToken.secret,
        config.tokenEncryptionKey,
      ),
      returnUrl: returnUrl || null,
      expiresAt: new Date(Date.now() + REQUEST_TOKEN_TTL_MS),
    },
  });
  const authorizationUrl = new URL(GARMIN_AUTHORIZE_URL);
  authorizationUrl.searchParams.set("oauth_token", requestToken.token);
  return { authorizationUrl: authorizationUrl.toString() };
};

export const finishGarminConnection = async (
  requestTokenValue: string,
  verifier: string,
): Promise<void> => {
  const config = requireGarminOAuthConfig();
  const request = await prisma.garminOAuthRequest.findUnique({
    where: { requestTokenHash: hashGarminRequestToken(requestTokenValue) },
  });
  if (!request || request.usedAt || request.expiresAt <= new Date()) {
    throw new Error("Garmin authorization request is invalid or expired");
  }
  const requestTokenSecret = decryptGarminSecret(
    request.requestTokenSecretEncrypted,
    config.tokenEncryptionKey,
  );
  const accessToken = await exchangeGarminToken(
    config,
    { token: requestTokenValue, secret: requestTokenSecret },
    verifier,
  );
  const garminUserId = await getGarminUserId(config, accessToken);
  const existingOwner = await prisma.garminIntegration.findUnique({
    where: { garminUserId },
    select: { userId: true },
  });
  if (existingOwner && existingOwner.userId !== request.userId) {
    throw new Error("This Garmin account is already connected to another user");
  }

  let permissions: string[] = [];
  try {
    permissions = await getGarminPermissions(config, accessToken);
  } catch (error) {
    logger.warn("Garmin permissions endpoint was unavailable", {
      userId: request.userId,
      status: error instanceof GarminApiError ? error.status : undefined,
    });
  }
  const now = new Date();

  await prisma.$transaction(async (transaction) => {
    const previous = await transaction.garminIntegration.findUnique({
      where: { userId: request.userId },
      select: { initialSyncStartedAt: true },
    });
    await transaction.garminIntegration.upsert({
      where: { userId: request.userId },
      create: {
        userId: request.userId,
        garminUserId,
        accessTokenEncrypted: encryptGarminSecret(
          accessToken.token,
          config.tokenEncryptionKey,
        ),
        accessTokenSecretEncrypted: encryptGarminSecret(
          accessToken.secret,
          config.tokenEncryptionKey,
        ),
        accessTokenHash: hashGarminAccessToken(accessToken.token),
        permissions,
        initialSyncStartedAt: now,
      },
      update: {
        garminUserId,
        accessTokenEncrypted: encryptGarminSecret(
          accessToken.token,
          config.tokenEncryptionKey,
        ),
        accessTokenSecretEncrypted: encryptGarminSecret(
          accessToken.secret,
          config.tokenEncryptionKey,
        ),
        accessTokenHash: hashGarminAccessToken(accessToken.token),
        permissions,
        disconnectedAt: null,
        backfillRequestedAt: null,
        initialSyncStartedAt: previous?.initialSyncStartedAt ?? now,
        lastSyncError: null,
        lastSyncErrorAt: null,
      },
    });
    await transaction.healthIntegration.upsert({
      where: {
        userId_provider_deviceId: {
          userId: request.userId,
          provider: GARMIN_HEALTH_PROVIDER,
          deviceId: garminDeviceId(garminUserId),
        },
      },
      create: {
        userId: request.userId,
        provider: GARMIN_HEALTH_PROVIDER,
        deviceId: garminDeviceId(garminUserId),
        requestedDataTypes,
        initialSyncStartAt: previous?.initialSyncStartedAt ?? now,
        lastSyncStartedAt: now,
      },
      update: {
        requestedDataTypes,
        disconnectedAt: null,
        lastSyncError: null,
        lastSyncErrorAt: null,
        initialSyncStartAt: previous?.initialSyncStartedAt ?? now,
        lastSyncStartedAt: now,
      },
    });
    await transaction.garminOAuthRequest.update({
      where: { id: request.id },
      data: { usedAt: now },
    });
  });

  void syncGarminForUser(request.userId, {
    requestBackfill: true,
    forceBackfill: true,
  }).catch((error) => {
    logger.error("Initial Garmin Connect sync failed", {
      userId: request.userId,
      error,
    });
  });
};

export const getGarminOAuthReturnUrl = async (
  requestTokenValue: string,
): Promise<string | null> => {
  const request = await prisma.garminOAuthRequest.findUnique({
    where: { requestTokenHash: hashGarminRequestToken(requestTokenValue) },
    select: { returnUrl: true },
  });
  return request?.returnUrl ?? null;
};

export const getStoredGarminAccessToken = async (
  userId: string,
): Promise<{
  config: GarminOAuthConfig;
  accessToken: GarminAccessToken;
  integration: {
    id: string;
    garminUserId: string | null;
    syncCursorSeconds: number | null;
    backfillRequestedAt: Date | null;
    backfillTargetStartSeconds: number | null;
    backfillCursorSeconds: number | null;
    backfillSummaryType: string | null;
    initialSyncStartedAt: Date | null;
    disconnectedAt: Date | null;
  };
} | null> => {
  const config = getGarminOAuthConfig();
  if (!config) return null;
  const integration = await prisma.garminIntegration.findUnique({
    where: { userId },
    select: {
      id: true,
      garminUserId: true,
      accessTokenEncrypted: true,
      accessTokenSecretEncrypted: true,
      syncCursorSeconds: true,
      backfillRequestedAt: true,
      backfillTargetStartSeconds: true,
      backfillCursorSeconds: true,
      backfillSummaryType: true,
      initialSyncStartedAt: true,
      disconnectedAt: true,
    },
  });
  if (!integration) return null;
  return {
    config,
    accessToken: {
      token: decryptGarminSecret(
        integration.accessTokenEncrypted,
        config.tokenEncryptionKey,
      ),
      secret: decryptGarminSecret(
        integration.accessTokenSecretEncrypted,
        config.tokenEncryptionKey,
      ),
    },
    integration: {
      id: integration.id,
      garminUserId: integration.garminUserId,
      syncCursorSeconds: integration.syncCursorSeconds,
      backfillRequestedAt: integration.backfillRequestedAt,
      backfillTargetStartSeconds: integration.backfillTargetStartSeconds,
      backfillCursorSeconds: integration.backfillCursorSeconds,
      backfillSummaryType: integration.backfillSummaryType,
      initialSyncStartedAt: integration.initialSyncStartedAt,
      disconnectedAt: integration.disconnectedAt,
    },
  };
};

async function ingestGarminData(
  userId: string,
  integrationId: string,
  data: GarminNormalizedData,
): Promise<void> {
  await prisma.$transaction(async (transaction) => {
    for (const metric of data.dailyMetrics) {
      await transaction.healthDailyMetric.upsert({
        where: {
          userId_provider_localDate_metric_aggregation_sourceBundleId: {
            userId,
            provider: GARMIN_HEALTH_PROVIDER,
            localDate: metric.localDate,
            metric: metric.metric,
            aggregation: metric.aggregation,
            sourceBundleId: metric.sourceBundleId,
          },
        },
        create: {
          userId,
          integrationId,
          provider: GARMIN_HEALTH_PROVIDER,
          ...metric,
          metadata: asJson(metric.metadata),
        },
        update: {
          integrationId,
          value: metric.value,
          unit: metric.unit,
          sourceName: metric.sourceName ?? null,
          timezone: metric.timezone ?? null,
          sampleCount: metric.sampleCount ?? null,
          metadata: asJson(metric.metadata),
        },
      });
    }
    for (const workout of data.workouts) {
      const { metadata, startAt, endAt, ...fields } = workout;
      await transaction.healthWorkout.upsert({
        where: {
          userId_provider_externalId: {
            userId,
            provider: GARMIN_HEALTH_PROVIDER,
            externalId: workout.externalId,
          },
        },
        create: {
          userId,
          integrationId,
          provider: GARMIN_HEALTH_PROVIDER,
          ...fields,
          metadata: asJson(metadata),
          startAt: new Date(startAt),
          endAt: new Date(endAt),
        },
        update: {
          integrationId,
          ...fields,
          metadata: asJson(metadata),
          startAt: new Date(startAt),
          endAt: new Date(endAt),
          deletedAt: null,
        },
      });
    }
    for (const sample of data.sleepSamples) {
      const { metadata, startAt, endAt, ...fields } = sample;
      await transaction.healthSleepSample.upsert({
        where: {
          userId_provider_externalId: {
            userId,
            provider: GARMIN_HEALTH_PROVIDER,
            externalId: sample.externalId,
          },
        },
        create: {
          userId,
          integrationId,
          provider: GARMIN_HEALTH_PROVIDER,
          ...fields,
          metadata: asJson(metadata),
          startAt: new Date(startAt),
          endAt: new Date(endAt),
        },
        update: {
          integrationId,
          ...fields,
          metadata: asJson(metadata),
          startAt: new Date(startAt),
          endAt: new Date(endAt),
          deletedAt: null,
        },
      });
    }
  });
}

async function markGarminSyncFailed(
  userId: string,
  error: unknown,
): Promise<void> {
  const message = errorMessage(error);
  const now = new Date();
  await Promise.all([
    prisma.garminIntegration.updateMany({
      where: { userId, disconnectedAt: null },
      data: { lastSyncErrorAt: now, lastSyncError: message },
    }),
    prisma.healthIntegration.updateMany({
      where: { userId, provider: GARMIN_HEALTH_PROVIDER, disconnectedAt: null },
      data: { lastSyncErrorAt: now, lastSyncError: message },
    }),
  ]);
}

async function pullActivityDetail(
  config: GarminOAuthConfig,
  accessToken: GarminAccessToken,
  activityId: string,
): Promise<GarminNormalizedData | null> {
  try {
    const payload = await getGarminJson(
      config,
      accessToken,
      "/activityDetails",
      {
        activityId,
      },
    );
    return normalizeGarminSummary("activityDetails", payload);
  } catch (error) {
    if (isIgnorableApiError(error)) return null;
    throw error;
  }
}

export async function syncGarminForUser(
  userId: string,
  options: GarminSyncOptions = {},
): Promise<GarminSyncResult | null> {
  if (syncLocks.has(userId)) return null;
  const stored = await getStoredGarminAccessToken(userId);
  if (
    !stored ||
    stored.integration.disconnectedAt ||
    !stored.integration.garminUserId
  ) {
    return null;
  }
  syncLocks.add(userId);
  const now = options.now ?? new Date();
  const nowSeconds = Math.floor(now.getTime() / 1000);
  const days = Math.min(
    7,
    Math.max(1, Math.floor(options.days ?? DEFAULT_SYNC_DAYS)),
  );
  const startSeconds = stored.integration.syncCursorSeconds
    ? Math.max(0, stored.integration.syncCursorSeconds - SYNC_OVERLAP_SECONDS)
    : Math.max(0, nowSeconds - days * 24 * 60 * 60);
  const counts = {
    dailyMetrics: 0,
    workouts: 0,
    sleepSamples: 0,
    summaryTypes: new Set<string>(),
    backfillRequested: false,
    backfillStatus: "not_requested" as
      | "not_requested"
      | "accepted"
      | "already_requested"
      | "rate_limited"
      | "unavailable"
      | "missing_permission",
  };
  const activityIds = new Set<string>();

  logger.info("Garmin Connect sync started", {
    userId,
    days,
    requestBackfill: options.requestBackfill !== false,
    hasSyncCursor: stored.integration.syncCursorSeconds != null,
  });

  try {
    const healthIntegration = await prisma.healthIntegration.upsert({
      where: {
        userId_provider_deviceId: {
          userId,
          provider: GARMIN_HEALTH_PROVIDER,
          deviceId: garminDeviceId(stored.integration.garminUserId),
        },
      },
      create: {
        userId,
        provider: GARMIN_HEALTH_PROVIDER,
        deviceId: garminDeviceId(stored.integration.garminUserId),
        requestedDataTypes,
        initialSyncStartAt: stored.integration.initialSyncStartedAt ?? now,
        lastSyncStartedAt: now,
      },
      update: {
        requestedDataTypes,
        disconnectedAt: null,
      },
      select: { id: true },
    });
    await prisma.garminIntegration.update({
      where: { userId },
      data: {
        lastSyncStartedAt: now,
        lastSyncError: null,
        lastSyncErrorAt: null,
      },
    });
    await prisma.healthIntegration.updateMany({
      where: {
        userId,
        provider: GARMIN_HEALTH_PROVIDER,
        deviceId: garminDeviceId(stored.integration.garminUserId),
      },
      data: {
        lastSyncStartedAt: now,
        lastSyncError: null,
        lastSyncErrorAt: null,
      },
    });

    const permissions = await refreshGarminPermissions(
      userId,
      stored.config,
      stored.accessToken,
    );
    logger.info("Garmin permissions refreshed", {
      userId,
      permissionCount: permissions.length,
      hasActivityExport: permissions.includes("ACTIVITY_EXPORT"),
      hasHistoricalDataExport: permissions.includes("HISTORICAL_DATA_EXPORT"),
    });

    const hasPendingBackfill =
      stored.integration.backfillTargetStartSeconds != null &&
      stored.integration.backfillCursorSeconds != null &&
      stored.integration.backfillSummaryType != null;
    const shouldProcessBackfill =
      options.requestBackfill !== false &&
      (hasPendingBackfill ||
        options.forceBackfill ||
        !stored.integration.backfillRequestedAt);

    if (shouldProcessBackfill) {
      if (!permissions.includes("HISTORICAL_DATA_EXPORT")) {
        counts.backfillStatus = "missing_permission";
        logger.warn("Garmin historical backfill skipped without permission", {
          userId,
          permissions,
        });
      }
      if (counts.backfillStatus !== "missing_permission") {
        const requestedBackfillDays = Math.min(
          MAX_BACKFILL_DAYS,
          Math.max(1, Math.floor(options.backfillDays ?? INITIAL_BACKFILL_DAYS)),
        );
        const requestedBackfillStart = Math.max(
          0,
          nowSeconds - requestedBackfillDays * 24 * 60 * 60,
        );
        const backfillStart = hasPendingBackfill
          ? stored.integration.backfillTargetStartSeconds!
          : requestedBackfillStart;
        const windowStart = hasPendingBackfill
          ? stored.integration.backfillCursorSeconds!
          : requestedBackfillStart;
        const summaryType = hasPendingBackfill
          ? stored.integration.backfillSummaryType!
          : BACKFILL_SUMMARY_TYPES[0];
        const windowEnd = Math.min(
          nowSeconds,
          windowStart + MAX_BACKFILL_WINDOW_DAYS * 24 * 60 * 60,
        );

        if (!hasPendingBackfill) {
          await prisma.garminIntegration.update({
            where: { userId },
            data: {
              backfillTargetStartSeconds: backfillStart,
              backfillCursorSeconds: windowStart,
              backfillSummaryType: summaryType,
            },
          });
        }

        let advanceBackfill = false;
        try {
          await requestGarminBackfill(
            stored.config,
            stored.accessToken,
            summaryType,
            windowStart,
            windowEnd,
          );
          counts.backfillRequested = true;
          counts.backfillStatus = "accepted";
          advanceBackfill = true;
        } catch (error) {
          if (!isIgnorableBackfillError(error)) throw error;
          counts.backfillStatus = backfillStatusForError(error);
          advanceBackfill =
            !(error instanceof GarminApiError) || error.status !== 429;
          logger.warn("Garmin backfill endpoint rejected a summary type", {
            userId,
            summaryType,
            windowStart,
            windowEnd,
            status: error instanceof GarminApiError ? error.status : undefined,
            providerMessage:
              error instanceof GarminApiError
                ? error.responseBody
                : undefined,
          });
        }

        if (advanceBackfill) {
          const summaryIndex = BACKFILL_SUMMARY_TYPES.indexOf(
            summaryType as (typeof BACKFILL_SUMMARY_TYPES)[number],
          );
          const nextSummaryType = BACKFILL_SUMMARY_TYPES[summaryIndex + 1];
          const nextWindowStart = nextSummaryType ? windowStart : windowEnd;
          const complete = !nextSummaryType && windowEnd >= nowSeconds;
          await prisma.garminIntegration.update({
            where: { userId },
            data: complete
              ? {
                  backfillRequestedAt: now,
                  backfillTargetStartSeconds: null,
                  backfillCursorSeconds: null,
                  backfillSummaryType: null,
                }
              : {
                  backfillRequestedAt: now,
                  backfillTargetStartSeconds: backfillStart,
                  backfillCursorSeconds: nextWindowStart,
                  backfillSummaryType:
                    nextSummaryType ?? BACKFILL_SUMMARY_TYPES[0],
                },
          });
        }
      }
    }

    for (
      let windowStart = startSeconds;
      windowStart < nowSeconds;
      windowStart += MAX_PULL_WINDOW_SECONDS
    ) {
      const windowEnd = Math.min(
        nowSeconds,
        windowStart + MAX_PULL_WINDOW_SECONDS,
      );
      for (const summaryType of SYNC_SUMMARY_TYPES) {
        try {
          const payload = await getGarminJson(
            stored.config,
            stored.accessToken,
            `/${summaryType}`,
            {
              uploadStartTimeInSeconds: windowStart,
              uploadEndTimeInSeconds: windowEnd,
            },
          );
          const normalized = normalizeGarminSummary(summaryType, payload);
          await ingestGarminData(userId, healthIntegration.id, normalized);
          counts.dailyMetrics += normalized.dailyMetrics.length;
          counts.workouts += normalized.workouts.length;
          counts.sleepSamples += normalized.sleepSamples.length;
          normalized.summaryTypes.forEach((value) =>
            counts.summaryTypes.add(value),
          );
          normalized.workouts.forEach((workout) =>
            activityIds.add(workout.externalId),
          );
        } catch (error) {
          if (!isIgnorableApiError(error)) throw error;
          logger.warn("Garmin summary endpoint was unavailable", {
            userId,
            summaryType,
            status: error instanceof GarminApiError ? error.status : undefined,
          });
        }
      }
      await prisma.garminIntegration.update({
        where: { userId },
        data: { syncCursorSeconds: windowEnd },
      });
    }

    for (const activityId of [...activityIds].slice(0, 100)) {
      const detail = await pullActivityDetail(
        stored.config,
        stored.accessToken,
        activityId,
      );
      if (!detail) continue;
      await ingestGarminData(userId, healthIntegration.id, detail);
      counts.dailyMetrics += detail.dailyMetrics.length;
      counts.workouts += detail.workouts.length;
      counts.sleepSamples += detail.sleepSamples.length;
      detail.summaryTypes.forEach((value) => counts.summaryTypes.add(value));
    }

    await updateSleepScoresForProvider(userId, GARMIN_HEALTH_PROVIDER);

    const completedAt = new Date();
    await Promise.all([
      prisma.garminIntegration.update({
        where: { userId },
        data: {
          lastSyncCompletedAt: completedAt,
          lastSyncError: null,
          lastSyncErrorAt: null,
        },
      }),
      prisma.healthIntegration.updateMany({
        where: {
          userId,
          provider: GARMIN_HEALTH_PROVIDER,
          deviceId: garminDeviceId(stored.integration.garminUserId),
        },
        data: {
          lastSyncCompletedAt: completedAt,
          lastSyncError: null,
          lastSyncErrorAt: null,
        },
      }),
    ]);
    const result = {
      counts: {
        dailyMetrics: counts.dailyMetrics,
        workouts: counts.workouts,
        sleepSamples: counts.sleepSamples,
        summaryTypes: counts.summaryTypes.size,
        backfillRequested: counts.backfillRequested,
        backfillStatus: counts.backfillStatus,
      },
      lastSyncCompletedAt: completedAt.toISOString(),
    };
    logger.info("Garmin Connect sync completed", {
      userId,
      ...result.counts,
      lastSyncCompletedAt: result.lastSyncCompletedAt,
    });
    return result;
  } catch (error) {
    await markGarminSyncFailed(userId, error).catch(() => undefined);
    logger.error("Garmin Connect sync failed", {
      userId,
      ...errorContext(error),
    });
    throw error;
  } finally {
    syncLocks.delete(userId);
  }
}

export async function syncAllGarminIntegrations(): Promise<void> {
  if (!getGarminOAuthConfig()) return;
  const integrations = await prisma.garminIntegration.findMany({
    where: { disconnectedAt: null },
    select: { userId: true },
  });
  for (const integration of integrations) {
    try {
      await syncGarminForUser(integration.userId, {
        requestBackfill: true,
        backfillDays: INITIAL_BACKFILL_DAYS,
      });
    } catch (error) {
      logger.error("Scheduled Garmin Connect sync failed", {
        userId: integration.userId,
        error,
      });
    }
  }
}

export async function ingestGarminWebhook(
  payload: GarminWebhookPayload,
): Promise<{
  processed: number;
  dailyMetrics: number;
  workouts: number;
  sleepSamples: number;
}> {
  let processed = 0;
  let dailyMetrics = 0;
  let workouts = 0;
  let sleepSamples = 0;
  const updatedUsers = new Set<string>();

  for (const raw of payloadRecords(payload.deregistrations)) {
    const record = webhookRecord(raw);
    if (!record) continue;
    const integration = await findIntegrationForWebhookRecord(record);
    if (!integration) continue;
    await disconnectGarminLocally(integration.userId, false);
    processed += 1;
  }

  for (const summaryType of WEBHOOK_SUMMARY_TYPES) {
    const group = payload[summaryType];
    if (group == null) continue;
    for (const raw of payloadRecords(group)) {
      const record = webhookRecord(raw);
      if (!record) continue;
      const integration = await findIntegrationForWebhookRecord(record);
      if (!integration || integration.disconnectedAt) continue;
      try {
        let sourcePayload: unknown = record;
        if (typeof record.callbackURL === "string" && record.callbackURL) {
          if (
            !isAllowedGarminCallbackUrl(
              record.callbackURL,
              integration.config.apiBaseUrl,
            )
          ) {
            throw new GarminApiError(400, "callback");
          }
          sourcePayload = JSON.parse(
            await requestGarminApiText(
              "GET",
              integration.config,
              integration.accessToken,
              record.callbackURL,
            ),
          ) as unknown;
        }
        const normalized = normalizeGarminSummary(summaryType, sourcePayload);
        await ingestGarminData(integration.userId, integration.id, normalized);
        updatedUsers.add(integration.userId);
        dailyMetrics += normalized.dailyMetrics.length;
        workouts += normalized.workouts.length;
        sleepSamples += normalized.sleepSamples.length;
        processed += 1;
      } catch (error) {
        await markGarminSyncFailed(integration.userId, error).catch(
          () => undefined,
        );
        logger.error("Garmin webhook record failed", {
          userId: integration.userId,
          summaryType,
          error,
        });
      }
    }
  }

  for (const userId of updatedUsers) {
    await updateSleepScoresForProvider(userId, GARMIN_HEALTH_PROVIDER);
  }

  return { processed, dailyMetrics, workouts, sleepSamples };
}

async function findIntegrationForWebhookRecord(
  record: GarminWebhookRecord,
): Promise<{
  id: string;
  userId: string;
  garminUserId: string | null;
  disconnectedAt: Date | null;
  config: GarminOAuthConfig;
  accessToken: GarminAccessToken;
} | null> {
  const config = getGarminOAuthConfig();
  if (!config) return null;
  const accessTokenHash =
    typeof record.userAccessToken === "string"
      ? hashGarminAccessToken(record.userAccessToken)
      : undefined;
  const integration = accessTokenHash
    ? await prisma.garminIntegration.findUnique({
        where: { accessTokenHash },
        select: {
          id: true,
          userId: true,
          garminUserId: true,
          disconnectedAt: true,
          accessTokenEncrypted: true,
          accessTokenSecretEncrypted: true,
        },
      })
    : typeof record.userId === "string"
      ? await prisma.garminIntegration.findUnique({
          where: { garminUserId: record.userId },
          select: {
            id: true,
            userId: true,
            garminUserId: true,
            disconnectedAt: true,
            accessTokenEncrypted: true,
            accessTokenSecretEncrypted: true,
          },
        })
      : null;
  if (!integration) return null;
  return {
    id: integration.id,
    userId: integration.userId,
    garminUserId: integration.garminUserId,
    disconnectedAt: integration.disconnectedAt,
    config,
    accessToken: {
      token: decryptGarminSecret(
        integration.accessTokenEncrypted,
        config.tokenEncryptionKey,
      ),
      secret: decryptGarminSecret(
        integration.accessTokenSecretEncrypted,
        config.tokenEncryptionKey,
      ),
    },
  };
}

async function disconnectGarminLocally(
  userId: string,
  deleteImportedData: boolean,
): Promise<void> {
  if (!deleteImportedData) {
    const disconnectedAt = new Date();
    await Promise.all([
      prisma.garminIntegration.updateMany({
        where: { userId, disconnectedAt: null },
        data: { disconnectedAt },
      }),
      prisma.healthIntegration.updateMany({
        where: {
          userId,
          provider: GARMIN_HEALTH_PROVIDER,
          disconnectedAt: null,
        },
        data: { disconnectedAt },
      }),
    ]);
    return;
  }

  await prisma.$transaction(async (transaction) => {
    const importedEntries =
      await transaction.healthWorkoutReconciliation.findMany({
        where: {
          userId,
          action: "import_new",
          activityEntry: {
            source: {
              in: [GARMIN_HEALTH_PROVIDER, `${GARMIN_HEALTH_PROVIDER}_linked`],
            },
          },
        },
        select: {
          activityEntryId: true,
          createdActivity: true,
          activityEntry: { select: { activityId: true } },
        },
      });
    const importedEntryIds = importedEntries
      .map((entry) => entry.activityEntryId)
      .filter((value): value is string => Boolean(value));
    const createdActivityIds = importedEntries
      .filter((entry) => entry.createdActivity)
      .map((entry) => entry.activityEntry?.activityId)
      .filter((value): value is string => Boolean(value));
    if (importedEntryIds.length) {
      await transaction.activityEntry.deleteMany({
        where: {
          id: { in: importedEntryIds },
          userId,
          source: {
            in: [GARMIN_HEALTH_PROVIDER, `${GARMIN_HEALTH_PROVIDER}_linked`],
          },
        },
      });
    }
    if (createdActivityIds.length) {
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
      where: { userId, provider: GARMIN_HEALTH_PROVIDER },
    });
    await transaction.healthWorkout.deleteMany({
      where: { userId, provider: GARMIN_HEALTH_PROVIDER },
    });
    await transaction.healthSleepSample.deleteMany({
      where: { userId, provider: GARMIN_HEALTH_PROVIDER },
    });
    await transaction.healthIntegration.deleteMany({
      where: { userId, provider: GARMIN_HEALTH_PROVIDER },
    });
    await transaction.garminIntegration.deleteMany({ where: { userId } });
  });
}

export async function disconnectGarmin(
  userId: string,
  deleteImportedData: boolean,
): Promise<void> {
  const stored = await getStoredGarminAccessToken(userId);
  if (stored) {
    try {
      await deleteGarminUser(stored.config, stored.accessToken);
    } catch (error) {
      logger.warn("Garmin remote user deletion failed; disconnecting locally", {
        userId,
        status: error instanceof GarminApiError ? error.status : undefined,
      });
    }
  }
  await disconnectGarminLocally(userId, deleteImportedData);
}

export async function getGarminDailyMetrics(
  userId: string,
  days = 14,
): Promise<{ metrics: Array<Record<string, unknown>> }> {
  const startDate = new Date(
    Date.now() - Math.max(1, days - 1) * 24 * 60 * 60 * 1000,
  )
    .toISOString()
    .slice(0, 10);
  const metrics = await prisma.healthDailyMetric.findMany({
    where: {
      userId,
      provider: GARMIN_HEALTH_PROVIDER,
      localDate: { gte: startDate },
      metric: {
        in: [
          "resting_heart_rate",
          "heart_rate_variability_sdnn",
          "respiratory_rate",
          "oxygen_saturation",
        ],
      },
    },
    orderBy: [{ localDate: "asc" }, { metric: "asc" }],
    select: {
      localDate: true,
      metric: true,
      aggregation: true,
      value: true,
      unit: true,
      provider: true,
      sourceName: true,
      sampleCount: true,
    },
  });
  return { metrics };
}

export { GARMIN_SOURCE, GARMIN_SOURCE_NAME };
