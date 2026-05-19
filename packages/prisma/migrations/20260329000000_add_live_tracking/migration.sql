-- ActivityEntry: add live tracking columns
ALTER TABLE "public"."activity_entries" ADD COLUMN "startedAt" TIMESTAMP(3);
ALTER TABLE "public"."activity_entries" ADD COLUMN "endedAt" TIMESTAMP(3);
ALTER TABLE "public"."activity_entries" ADD COLUMN "isLiveTracked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "public"."activity_entries" ADD COLUMN "distanceMeters" DOUBLE PRECISION;
ALTER TABLE "public"."activity_entries" ADD COLUMN "durationSeconds" INTEGER;

-- LocationPoint table
CREATE TABLE "public"."location_points" (
    "id" TEXT NOT NULL,
    "activityEntryId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "altitude" DOUBLE PRECISION,
    "accuracy" DOUBLE PRECISION,
    "speed" DOUBLE PRECISION,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "location_points_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "location_points_activityEntryId_timestamp_idx" ON "public"."location_points"("activityEntryId", "timestamp");
CREATE INDEX "location_points_timestamp_idx" ON "public"."location_points"("timestamp");
ALTER TABLE "public"."location_points" ADD CONSTRAINT "location_points_activityEntryId_fkey"
    FOREIGN KEY ("activityEntryId") REFERENCES "public"."activity_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
