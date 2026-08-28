-- CreateTable
CREATE TABLE "public"."health_integrations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'apple_health',
    "deviceId" TEXT NOT NULL,
    "requestedDataTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "initialSyncStartAt" TIMESTAMP(3),
    "lastSyncStartedAt" TIMESTAMP(3),
    "lastSyncCompletedAt" TIMESTAMP(3),
    "lastSyncErrorAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "disconnectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "health_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."health_daily_metrics" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "integrationId" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'apple_health',
    "localDate" VARCHAR(10) NOT NULL,
    "metric" TEXT NOT NULL,
    "aggregation" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "sourceBundleId" TEXT NOT NULL DEFAULT '__healthkit_merged__',
    "sourceName" TEXT,
    "timezone" TEXT,
    "sampleCount" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "health_daily_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."health_workouts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "integrationId" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'apple_health',
    "externalId" TEXT NOT NULL,
    "activityTypeCode" INTEGER NOT NULL,
    "activityTypeName" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "durationSeconds" DOUBLE PRECISION NOT NULL,
    "activeEnergyKcal" DOUBLE PRECISION,
    "distanceMeters" DOUBLE PRECISION,
    "sourceBundleId" TEXT NOT NULL,
    "sourceName" TEXT,
    "sourceProductType" TEXT,
    "deviceName" TEXT,
    "deviceModel" TEXT,
    "timezone" TEXT,
    "metadata" JSONB,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "health_workouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."health_sleep_samples" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "integrationId" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'apple_health',
    "externalId" TEXT NOT NULL,
    "stageCode" INTEGER NOT NULL,
    "stage" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "sourceBundleId" TEXT NOT NULL,
    "sourceName" TEXT,
    "sourceProductType" TEXT,
    "deviceName" TEXT,
    "deviceModel" TEXT,
    "timezone" TEXT,
    "metadata" JSONB,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "health_sleep_samples_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "health_integrations_userId_provider_deviceId_key" ON "public"."health_integrations"("userId", "provider", "deviceId");
CREATE INDEX "health_integrations_userId_provider_disconnectedAt_idx" ON "public"."health_integrations"("userId", "provider", "disconnectedAt");
CREATE UNIQUE INDEX "health_daily_metrics_userId_provider_localDate_metric_aggregation_sourceBundleId_key" ON "public"."health_daily_metrics"("userId", "provider", "localDate", "metric", "aggregation", "sourceBundleId");
CREATE INDEX "health_daily_metrics_userId_metric_localDate_idx" ON "public"."health_daily_metrics"("userId", "metric", "localDate");
CREATE INDEX "health_daily_metrics_userId_localDate_idx" ON "public"."health_daily_metrics"("userId", "localDate");
CREATE INDEX "health_daily_metrics_integrationId_idx" ON "public"."health_daily_metrics"("integrationId");
CREATE UNIQUE INDEX "health_workouts_userId_provider_externalId_key" ON "public"."health_workouts"("userId", "provider", "externalId");
CREATE INDEX "health_workouts_userId_startAt_deletedAt_idx" ON "public"."health_workouts"("userId", "startAt", "deletedAt");
CREATE INDEX "health_workouts_userId_activityTypeName_startAt_idx" ON "public"."health_workouts"("userId", "activityTypeName", "startAt");
CREATE INDEX "health_workouts_integrationId_idx" ON "public"."health_workouts"("integrationId");
CREATE UNIQUE INDEX "health_sleep_samples_userId_provider_externalId_key" ON "public"."health_sleep_samples"("userId", "provider", "externalId");
CREATE INDEX "health_sleep_samples_userId_startAt_deletedAt_idx" ON "public"."health_sleep_samples"("userId", "startAt", "deletedAt");
CREATE INDEX "health_sleep_samples_userId_stage_startAt_idx" ON "public"."health_sleep_samples"("userId", "stage", "startAt");
CREATE INDEX "health_sleep_samples_integrationId_idx" ON "public"."health_sleep_samples"("integrationId");

-- AddForeignKey
ALTER TABLE "public"."health_integrations" ADD CONSTRAINT "health_integrations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."health_daily_metrics" ADD CONSTRAINT "health_daily_metrics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."health_daily_metrics" ADD CONSTRAINT "health_daily_metrics_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "public"."health_integrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."health_workouts" ADD CONSTRAINT "health_workouts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."health_workouts" ADD CONSTRAINT "health_workouts_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "public"."health_integrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."health_sleep_samples" ADD CONSTRAINT "health_sleep_samples_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."health_sleep_samples" ADD CONSTRAINT "health_sleep_samples_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "public"."health_integrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
