CREATE TABLE "public"."health_workout_reconciliations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "healthWorkoutId" TEXT NOT NULL,
    "activityEntryId" TEXT,
    "action" TEXT NOT NULL,
    "matchConfidence" DOUBLE PRECISION,
    "matchReasons" JSONB,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "health_workout_reconciliations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "health_workout_reconciliations_healthWorkoutId_key"
ON "public"."health_workout_reconciliations"("healthWorkoutId");

CREATE INDEX "health_workout_reconciliations_userId_action_idx"
ON "public"."health_workout_reconciliations"("userId", "action");

CREATE INDEX "health_workout_reconciliations_activityEntryId_idx"
ON "public"."health_workout_reconciliations"("activityEntryId");

ALTER TABLE "public"."health_workout_reconciliations"
ADD CONSTRAINT "health_workout_reconciliations_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "public"."users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."health_workout_reconciliations"
ADD CONSTRAINT "health_workout_reconciliations_healthWorkoutId_fkey"
FOREIGN KEY ("healthWorkoutId") REFERENCES "public"."health_workouts"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."health_workout_reconciliations"
ADD CONSTRAINT "health_workout_reconciliations_activityEntryId_fkey"
FOREIGN KEY ("activityEntryId") REFERENCES "public"."activity_entries"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
