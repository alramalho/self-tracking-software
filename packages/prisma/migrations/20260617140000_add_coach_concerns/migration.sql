CREATE TYPE "public"."CoachConcernStatus" AS ENUM (
  'OPEN',
  'RAISED',
  'ESCALATED',
  'RESOLVED',
  'SNOOZED',
  'ARCHIVED'
);

CREATE TABLE "public"."coach_concerns" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "planId" TEXT,
  "kind" TEXT NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "status" "public"."CoachConcernStatus" NOT NULL DEFAULT 'OPEN',
  "severity" INTEGER NOT NULL DEFAULT 0,
  "data" JSONB,
  "raisedCount" INTEGER NOT NULL DEFAULT 0,
  "firstDetectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastDetectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastRaisedAt" TIMESTAMP(3),
  "nextEligibleAt" TIMESTAMP(3),
  "snoozedUntil" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "resolvedReason" TEXT,
  "lastMessageId" TEXT,
  "lastNotificationId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "coach_concerns_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "coach_concerns_userId_dedupeKey_key" ON "public"."coach_concerns"("userId", "dedupeKey");
CREATE INDEX "coach_concerns_userId_status_idx" ON "public"."coach_concerns"("userId", "status");
CREATE INDEX "coach_concerns_planId_idx" ON "public"."coach_concerns"("planId");

ALTER TABLE "public"."coach_concerns"
ADD CONSTRAINT "coach_concerns_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "public"."users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."coach_concerns"
ADD CONSTRAINT "coach_concerns_planId_fkey"
FOREIGN KEY ("planId") REFERENCES "public"."plans"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
