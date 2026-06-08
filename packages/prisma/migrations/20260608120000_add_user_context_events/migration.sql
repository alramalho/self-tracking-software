CREATE TYPE "public"."UserContextEventSource" AS ENUM (
  'USER_REPORTED',
  'COACH_INFERRED',
  'USER_CONFIRMED'
);

CREATE TABLE "public"."user_context_events" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "occurredAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  "source" "public"."UserContextEventSource" NOT NULL DEFAULT 'USER_REPORTED',
  "sourceMessageId" TEXT,
  "confidence" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),

  CONSTRAINT "user_context_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "user_context_events_userId_idx" ON "public"."user_context_events"("userId");
CREATE INDEX "user_context_events_userId_occurredAt_idx" ON "public"."user_context_events"("userId", "occurredAt");
CREATE INDEX "user_context_events_sourceMessageId_idx" ON "public"."user_context_events"("sourceMessageId");

ALTER TABLE "public"."user_context_events"
ADD CONSTRAINT "user_context_events_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "public"."users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
