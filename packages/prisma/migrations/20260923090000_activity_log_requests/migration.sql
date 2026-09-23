CREATE TABLE "public"."activity_log_requests" (
  "userId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "entryId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "activity_log_requests_pkey" PRIMARY KEY ("userId", "requestId")
);

CREATE INDEX "activity_log_requests_entryId_idx" ON "public"."activity_log_requests"("entryId");

ALTER TABLE "public"."activity_log_requests"
  ADD CONSTRAINT "activity_log_requests_entryId_fkey"
  FOREIGN KEY ("entryId") REFERENCES "public"."activity_entries"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "public"."activity_photo_requests" (
  "userId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "entryId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "activity_photo_requests_pkey" PRIMARY KEY ("userId", "requestId")
);

CREATE INDEX "activity_photo_requests_entryId_idx" ON "public"."activity_photo_requests"("entryId");

ALTER TABLE "public"."activity_photo_requests"
  ADD CONSTRAINT "activity_photo_requests_entryId_fkey"
  FOREIGN KEY ("entryId") REFERENCES "public"."activity_entries"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
