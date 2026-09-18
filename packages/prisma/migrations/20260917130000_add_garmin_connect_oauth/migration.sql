CREATE TABLE "public"."garmin_integrations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "garminUserId" TEXT,
    "accessTokenEncrypted" TEXT NOT NULL,
    "accessTokenSecretEncrypted" TEXT NOT NULL,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastSyncStartedAt" TIMESTAMP(3),
    "lastSyncCompletedAt" TIMESTAMP(3),
    "lastSyncErrorAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "garmin_integrations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."garmin_oauth_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestTokenHash" TEXT NOT NULL,
    "requestTokenSecretEncrypted" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "garmin_oauth_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "garmin_integrations_userId_key" ON "public"."garmin_integrations"("userId");
CREATE UNIQUE INDEX "garmin_integrations_garminUserId_key" ON "public"."garmin_integrations"("garminUserId");
CREATE UNIQUE INDEX "garmin_oauth_requests_requestTokenHash_key" ON "public"."garmin_oauth_requests"("requestTokenHash");
CREATE INDEX "garmin_oauth_requests_userId_expiresAt_idx" ON "public"."garmin_oauth_requests"("userId", "expiresAt");

ALTER TABLE "public"."garmin_integrations"
  ADD CONSTRAINT "garmin_integrations_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."garmin_oauth_requests"
  ADD CONSTRAINT "garmin_oauth_requests_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
