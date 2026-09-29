-- Circles need proof: a member counts once they post their first photo log on the circle plan.
-- Additive only. Existing members are grandfathered as proven, and every circle becomes open.

-- CreateEnum
CREATE TYPE "public"."CircleEventKind" AS ENUM ('JOINED', 'PROVED', 'PROOF_SKIPPED', 'PROOF_NUDGED', 'EXPIRED', 'LEFT');

-- AlterTable
ALTER TABLE "public"."circle_members" ADD COLUMN "provenAt" TIMESTAMP(3),
ADD COLUMN "proofNudgedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "public"."circle_events" (
    "id" TEXT NOT NULL,
    "circleId" TEXT,
    "userId" TEXT NOT NULL,
    "planId" TEXT,
    "kind" "public"."CircleEventKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "circle_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "circle_events_userId_createdAt_idx" ON "public"."circle_events"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "circle_events_kind_createdAt_idx" ON "public"."circle_events"("kind", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."circle_events" ADD CONSTRAINT "circle_events_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "public"."circles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."circle_events" ADD CONSTRAINT "circle_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Members from before proof existed already count.
UPDATE "public"."circle_members" SET "provenAt" = "joinedAt" WHERE "provenAt" IS NULL;

-- All circles are open: discoverable and matchable. Invite links keep working.
UPDATE "public"."circles" SET "openToMatching" = true, "discoverable" = true;
