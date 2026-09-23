ALTER TABLE "public"."notifications" ADD COLUMN "dedupeKey" TEXT;
ALTER TABLE "public"."notifications" ADD COLUMN "deliveryClaimedAt" TIMESTAMP(3);
ALTER TABLE "public"."notifications" ADD COLUMN "deliveryAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "public"."notifications" ADD COLUMN "nextDeliveryAttemptAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "notifications_dedupeKey_key" ON "public"."notifications"("dedupeKey");
