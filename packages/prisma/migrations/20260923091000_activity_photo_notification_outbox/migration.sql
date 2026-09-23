CREATE TABLE "public"."activity_photo_notification_outbox" (
    "entryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "activity_photo_notification_outbox_pkey" PRIMARY KEY ("entryId")
);

CREATE INDEX "activity_photo_notification_outbox_processedAt_nextAttemptAt_createdAt_idx"
ON "public"."activity_photo_notification_outbox"("processedAt", "nextAttemptAt", "createdAt");

ALTER TABLE "public"."activity_photo_notification_outbox"
ADD CONSTRAINT "activity_photo_notification_outbox_entryId_fkey"
FOREIGN KEY ("entryId") REFERENCES "public"."activity_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
