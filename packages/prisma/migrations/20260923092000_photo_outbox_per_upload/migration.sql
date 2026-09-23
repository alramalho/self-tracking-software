ALTER TABLE "public"."activity_photo_notification_outbox"
ADD COLUMN "id" TEXT,
ADD COLUMN "photoAddedAt" TIMESTAMP(3);

UPDATE "public"."activity_photo_notification_outbox" AS work
SET "id" = work."entryId",
    "photoAddedAt" = COALESCE(entry."imageCreatedAt", work."createdAt")
FROM "public"."activity_entries" AS entry
WHERE entry."id" = work."entryId";

ALTER TABLE "public"."activity_photo_notification_outbox"
ALTER COLUMN "id" SET NOT NULL,
ALTER COLUMN "photoAddedAt" SET NOT NULL,
ALTER COLUMN "photoAddedAt" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "public"."activity_photo_notification_outbox"
DROP CONSTRAINT "activity_photo_notification_outbox_pkey";

ALTER TABLE "public"."activity_photo_notification_outbox"
ADD CONSTRAINT "activity_photo_notification_outbox_pkey" PRIMARY KEY ("id");

CREATE INDEX "activity_photo_notification_outbox_entryId_processedAt_idx"
ON "public"."activity_photo_notification_outbox"("entryId", "processedAt");
