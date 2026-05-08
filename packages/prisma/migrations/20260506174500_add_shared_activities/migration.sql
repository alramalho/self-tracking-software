CREATE TABLE "public"."shared_activities" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT NOT NULL,
  CONSTRAINT "shared_activities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."shared_activity_entries" (
  "id" TEXT NOT NULL,
  "sharedActivityId" TEXT NOT NULL,
  "activityEntryId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "shared_activity_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "shared_activity_entries_activityEntryId_key"
  ON "public"."shared_activity_entries"("activityEntryId");

CREATE UNIQUE INDEX "shared_activity_entries_sharedActivityId_userId_key"
  ON "public"."shared_activity_entries"("sharedActivityId", "userId");

CREATE INDEX "shared_activities_createdById_idx"
  ON "public"."shared_activities"("createdById");

CREATE INDEX "shared_activity_entries_sharedActivityId_idx"
  ON "public"."shared_activity_entries"("sharedActivityId");

CREATE INDEX "shared_activity_entries_userId_idx"
  ON "public"."shared_activity_entries"("userId");

CREATE INDEX "activity_entries_userId_datetime_deletedAt_idx"
  ON "public"."activity_entries"("userId", "datetime", "deletedAt");

ALTER TABLE "public"."shared_activities"
  ADD CONSTRAINT "shared_activities_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "public"."users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."shared_activity_entries"
  ADD CONSTRAINT "shared_activity_entries_sharedActivityId_fkey"
  FOREIGN KEY ("sharedActivityId") REFERENCES "public"."shared_activities"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."shared_activity_entries"
  ADD CONSTRAINT "shared_activity_entries_activityEntryId_fkey"
  FOREIGN KEY ("activityEntryId") REFERENCES "public"."activity_entries"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."shared_activity_entries"
  ADD CONSTRAINT "shared_activity_entries_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "public"."users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
