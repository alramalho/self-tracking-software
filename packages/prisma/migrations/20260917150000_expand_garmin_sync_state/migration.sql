ALTER TABLE "public"."garmin_integrations"
  ADD COLUMN "accessTokenHash" TEXT,
  ADD COLUMN "initialSyncStartedAt" TIMESTAMP(3),
  ADD COLUMN "backfillRequestedAt" TIMESTAMP(3),
  ADD COLUMN "syncCursorSeconds" INTEGER,
  ADD COLUMN "disconnectedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "garmin_integrations_accessTokenHash_key"
  ON "public"."garmin_integrations"("accessTokenHash");
