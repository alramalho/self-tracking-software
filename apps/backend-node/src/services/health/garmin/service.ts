import { randomBytes } from "node:crypto";
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
  createPkcePair,
  exchangeGarminOAuth2Code,
  garminOAuth2AuthorizationUrl,
  needsRefresh,
  refreshGarminOAuth2Tokens,
} from "./oauth2";
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
  GarminOAuth2Tokens,
  GarminWebhookPayload,
  GarminWebhookRecord,
} from "./types";

const REQUEST_TOKEN_TTL_MS = 10 * 60 * 1000;
// Garmin is webhook-only: data arrives by ping/push after the watch syncs. Ad-hoc or scheduled
// pulls are not permitted (Health API 1.2.4, §4 and §8). The one request we make ourselves is a
// single backfill when someone connects; its data also arrives through the webhook.
const INITIAL_BACKFILL_DAYS = 30;
const BACKFILL_SUMMARY_TYPES = [
  "activities",
  "activityDetails",
  "dailies",
  "sleeps",
  "hrv",
] as const;
const GARMIN_DEVICE_PREFIX = "garmin:";
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

/**
 * Garmin still runs on an evaluation key, so only listed testers see it
 * (GARMIN_TESTER_EMAILS, comma-separated). Set GARMIN_OPEN_TO_ALL=true once
 * Garmin approves the production key.
 */
export async function garminAvailableFor(userId: string): Promise<boolean> {
  if (!getGarminOAuthConfig()) return false;
  if (process.env.GARMIN_OPEN_TO_ALL === "true") return true;
  const testers = (process.env.GARMIN_TESTER_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  return !!user && testers.includes(user.email.toLowerCase());
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
    available: await garminAvailableFor(userId),
    connected: Boolean(integration),
    permissions: integration?.permissions ?? [],
    connectedAt: integration?.connectedAt.toISOString() ?? null,
    initialSyncStartedAt:
      integration?.initialSyncStartedAt?.toISOString() ?? null,
    backfillRequestedAt:
      integration?.backfillRequestedAt?.toISOString() ?? null,
    // Garmin delivers backfilled history over the following hours, not immediately.
    backfillInProgress:
      !!integration?.backfillRequestedAt &&
      Date.now() - integration.backfillRequestedAt.getTime() < 24 * 60 * 60 * 1000,
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
  await prisma.garminOAuthRequest.deleteMany({ where: { userId } });
  const expiresAt = new Date(Date.now() + REQUEST_TOKEN_TTL_MS);

  if (config.oauthVersion === 2) {
    // The OAuth request row holds the PKCE state (hashed) and code verifier (encrypted).
    const state = randomBytes(24).toString("base64url");
    const pkce = createPkcePair();
    await prisma.garminOAuthRequest.create({
      data: {
        userId,
        requestTokenHash: hashGarminRequestToken(state),
        requestTokenSecretEncrypted: encryptGarminSecret(pkce.verifier, config.tokenEncryptionKey),
        returnUrl: returnUrl || null,
        expiresAt,
      },
    });
    return { authorizationUrl: garminOAuth2AuthorizationUrl(config, state, pkce.challenge) };
  }

  const requestToken = await requestGarminToken(config);
  await prisma.garminOAuthRequest.create({
    data: {
      userId,
      requestTokenHash: hashGarminRequestToken(requestToken.token),
      requestTokenSecretEncrypted: encryptGarminSecret(requestToken.secret, config.tokenEncryptionKey),
      returnUrl: returnUrl || null,
      expiresAt,
    },
  });
  const authorizationUrl = new URL(GARMIN_AUTHORIZE_URL);
  authorizationUrl.searchParams.set("oauth_token", requestToken.token);
  return { authorizationUrl: authorizationUrl.toString() };
};

/** OAuth1 callback: ?oauth_token&oauth_verifier. OAuth2 callback: ?code&state. */
export const finishGarminConnection = async (
  callback: { requestToken: string; verifier: string } | { state: string; code: string },
): Promise<void> => {
  const config = requireGarminOAuthConfig();
  const key = "state" in callback ? callback.state : callback.requestToken;
  const request = await prisma.garminOAuthRequest.findUnique({
    where: { requestTokenHash: hashGarminRequestToken(key) },
  });
  if (!request || request.usedAt || request.expiresAt <= new Date()) {
    throw new Error("Garmin authorization request is invalid or expired");
  }
  const requestSecret = decryptGarminSecret(
    request.requestTokenSecretEncrypted,
    config.tokenEncryptionKey,
  );

  let accessToken: GarminAccessToken;
  let oauth2: GarminOAuth2Tokens | null = null;
  if ("state" in callback) {
    oauth2 = await exchangeGarminOAuth2Code(config, callback.code, requestSecret);
    accessToken = { version: 2, token: oauth2.accessToken };
  } else {
    accessToken = await exchangeGarminToken(
      config,
      { token: callback.requestToken, secret: requestSecret },
      callback.verifier,
    );
  }

  const garminUserId = await getGarminUserId(config, accessToken);
  const existingOwner = await prisma.garminIntegration.findUnique({
    where: { garminUserId },
    select: { userId: true },
  });
  if (existingOwner && existingOwner.userId !== request.userId) {
    throw new Error("This Garmin account is already connected to another user");
  }
  const permissions = await getGarminPermissions(config, accessToken).catch(() => []);
  const now = new Date();
  const encrypt = (value: string) => encryptGarminSecret(value, config.tokenEncryptionKey);
  const tokenFields = {
    oauthVersion: accessToken.version,
    accessTokenEncrypted: encrypt(accessToken.token),
    accessTokenSecretEncrypted: accessToken.version === 1 ? encrypt(accessToken.secret) : null,
    // OAuth1 pings carry the access token; OAuth2 pings carry only the Garmin user ID.
    accessTokenHash: accessToken.version === 1 ? hashGarminAccessToken(accessToken.token) : null,
    refreshTokenEncrypted: oauth2 ? encrypt(oauth2.refreshToken) : null,
    accessTokenExpiresAt: oauth2?.expiresAt ?? null,
  };

  await prisma.$transaction(async (transaction) => {
    await transaction.garminIntegration.upsert({
      where: { userId: request.userId },
      create: {
        userId: request.userId,
        garminUserId,
        ...tokenFields,
        permissions,
        initialSyncStartedAt: now,
      },
      update: {
        garminUserId,
        ...tokenFields,
        permissions,
        disconnectedAt: null,
        connectedAt: now,
        backfillRequestedAt: null,
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
        initialSyncStartAt: now,
        lastSyncStartedAt: now,
      },
      update: {
        requestedDataTypes,
        disconnectedAt: null,
        lastSyncError: null,
        lastSyncErrorAt: null,
      },
    });
    await transaction.garminOAuthRequest.update({
      where: { id: request.id },
      data: { usedAt: now },
    });
  });

  void requestInitialBackfill(request.userId, permissions).catch((error) =>
    logger.error("Garmin initial backfill failed", { userId: request.userId, error }),
  );
};

export const getGarminOAuthReturnUrl = async (
  requestTokenOrState: string,
): Promise<string | null> => {
  const request = await prisma.garminOAuthRequest.findUnique({
    where: { requestTokenHash: hashGarminRequestToken(requestTokenOrState) },
    select: { returnUrl: true },
  });
  return request?.returnUrl ?? null;
};

const integrationTokenSelect = {
  id: true,
  userId: true,
  garminUserId: true,
  disconnectedAt: true,
  oauthVersion: true,
  accessTokenEncrypted: true,
  accessTokenSecretEncrypted: true,
  refreshTokenEncrypted: true,
  accessTokenExpiresAt: true,
} as const;
type IntegrationTokenRow = Prisma.GarminIntegrationGetPayload<{
  select: typeof integrationTokenSelect;
}>;

/** Decrypt a stored token; OAuth2 tokens are refreshed (and saved) shortly before they expire. */
async function accessTokenFor(
  row: IntegrationTokenRow,
  config: GarminOAuthConfig,
): Promise<GarminAccessToken> {
  const decrypt = (value: string) => decryptGarminSecret(value, config.tokenEncryptionKey);
  if (row.oauthVersion !== 2)
    return {
      version: 1,
      token: decrypt(row.accessTokenEncrypted),
      secret: decrypt(row.accessTokenSecretEncrypted ?? ""),
    };
  if (!needsRefresh(row.accessTokenExpiresAt))
    return { version: 2, token: decrypt(row.accessTokenEncrypted) };
  const fresh = await refreshGarminOAuth2Tokens(config, decrypt(row.refreshTokenEncrypted ?? ""));
  await prisma.garminIntegration.update({
    where: { id: row.id },
    data: {
      accessTokenEncrypted: encryptGarminSecret(fresh.accessToken, config.tokenEncryptionKey),
      refreshTokenEncrypted: encryptGarminSecret(fresh.refreshToken, config.tokenEncryptionKey),
      accessTokenExpiresAt: fresh.expiresAt,
    },
  });
  return { version: 2, token: fresh.accessToken };
}

export const getStoredGarminAccessToken = async (
  userId: string,
): Promise<{
  config: GarminOAuthConfig;
  accessToken: GarminAccessToken;
  integration: IntegrationTokenRow;
} | null> => {
  const config = getGarminOAuthConfig();
  if (!config) return null;
  const integration = await prisma.garminIntegration.findUnique({
    where: { userId },
    select: integrationTokenSelect,
  });
  if (!integration) return null;
  return { config, accessToken: await accessTokenFor(integration, config), integration };
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

/**
 * One backfill request per summary type for the last 30 days. Garmin answers 202 and then
 * delivers the history through the same ping/push webhook as new data.
 */
async function requestInitialBackfill(userId: string, permissions: string[]): Promise<void> {
  if (!permissions.includes("HISTORICAL_DATA_EXPORT")) {
    logger.info("Garmin backfill skipped: user did not share historical data", { userId });
    return;
  }
  const stored = await getStoredGarminAccessToken(userId);
  if (!stored) return;
  const end = Math.floor(Date.now() / 1000);
  const start = end - INITIAL_BACKFILL_DAYS * 24 * 60 * 60;
  for (const summaryType of BACKFILL_SUMMARY_TYPES) {
    try {
      await requestGarminBackfill(stored.config, stored.accessToken, summaryType, start, end);
    } catch (error) {
      logger.warn("Garmin backfill request rejected", { userId, summaryType, ...errorContext(error) });
    }
  }
  await prisma.garminIntegration.update({
    where: { userId },
    data: { backfillRequestedAt: new Date() },
  });
}

/** Re-read what the person shares with us. A user endpoint, not a data pull. */
export async function refreshGarminConnection(userId: string): Promise<string[] | null> {
  const stored = await getStoredGarminAccessToken(userId);
  if (!stored || stored.integration.disconnectedAt) return null;
  return refreshGarminPermissions(userId, stored.config, stored.accessToken);
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

  // Sent when the person changes what they share in Garmin Connect after connecting.
  for (const raw of payloadRecords(payload.userPermissionsChange)) {
    const record = webhookRecord(raw);
    const permissions = (raw as { permissions?: unknown })?.permissions;
    if (!record || typeof record.userId !== "string" || !Array.isArray(permissions)) continue;
    await prisma.garminIntegration.updateMany({
      where: { garminUserId: record.userId },
      data: { permissions: permissions.filter((p): p is string => typeof p === "string") },
    });
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
        await ingestGarminData(
          integration.userId,
          await healthIntegrationIdFor(integration.userId, integration.garminUserId!),
          normalized,
        );
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
    await prisma.garminIntegration.updateMany({
      where: { userId },
      data: { lastSyncCompletedAt: new Date(), lastSyncError: null, lastSyncErrorAt: null },
    });
  }

  return { processed, dailyMetrics, workouts, sleepSamples };
}

/** Imported rows belong to the Health integration record, not the Garmin OAuth record. */
async function healthIntegrationIdFor(userId: string, garminUserId: string): Promise<string> {
  const deviceId = garminDeviceId(garminUserId);
  const row = await prisma.healthIntegration.upsert({
    where: {
      userId_provider_deviceId: { userId, provider: GARMIN_HEALTH_PROVIDER, deviceId },
    },
    create: { userId, provider: GARMIN_HEALTH_PROVIDER, deviceId, requestedDataTypes },
    update: {},
    select: { id: true },
  });
  return row.id;
}

async function findIntegrationForWebhookRecord(record: GarminWebhookRecord) {
  const config = getGarminOAuthConfig();
  if (!config) return null;
  const integration =
    typeof record.userId === "string"
      ? await prisma.garminIntegration.findUnique({
          where: { garminUserId: record.userId },
          select: integrationTokenSelect,
        })
      : typeof record.userAccessToken === "string"
        ? await prisma.garminIntegration.findUnique({
            where: { accessTokenHash: hashGarminAccessToken(record.userAccessToken) },
            select: integrationTokenSelect,
          })
        : null;
  if (!integration) return null;
  return { ...integration, config, accessToken: await accessTokenFor(integration, config) };
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
