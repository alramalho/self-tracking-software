-- Circles: small accountability groups that replace plan groups and practice circles.
-- Additive only. Old plan-group and practice-circle tables stay until a later cleanup migration.

-- AlterEnum
ALTER TYPE "public"."NotificationType" ADD VALUE 'CIRCLE';

-- CreateEnum
CREATE TYPE "public"."CircleStatus" AS ENUM ('FORMING', 'ACTIVE');

-- CreateEnum
CREATE TYPE "public"."CircleRole" AS ENUM ('OWNER', 'MEMBER');

-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN "approxLatitude" DOUBLE PRECISION,
ADD COLUMN "approxLongitude" DOUBLE PRECISION,
ADD COLUMN "approxPlace" TEXT;

-- AlterTable
ALTER TABLE "public"."activity_entries" ADD COLUMN "imagePreview" TEXT;

-- CreateTable
CREATE TABLE "public"."circles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "status" "public"."CircleStatus" NOT NULL DEFAULT 'FORMING',
    "openToMatching" BOOLEAN NOT NULL DEFAULT true,
    "discoverable" BOOLEAN NOT NULL DEFAULT true,
    "stalledNoticeAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "circles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."circle_members" (
    "circleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "role" "public"."CircleRole" NOT NULL DEFAULT 'MEMBER',
    "wantsPace" BOOLEAN NOT NULL DEFAULT true,
    "wantsNearby" BOOLEAN NOT NULL DEFAULT false,
    "wantsAge" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "circle_members_pkey" PRIMARY KEY ("circleId","userId")
);

-- CreateTable
CREATE TABLE "public"."circle_nudges" (
    "id" TEXT NOT NULL,
    "circleId" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "circle_nudges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "circles_inviteCode_key" ON "public"."circles"("inviteCode");

-- CreateIndex
CREATE UNIQUE INDEX "circle_members_planId_key" ON "public"."circle_members"("planId");

-- CreateIndex
CREATE INDEX "circle_members_userId_idx" ON "public"."circle_members"("userId");

-- CreateIndex
CREATE INDEX "circle_nudges_toId_createdAt_idx" ON "public"."circle_nudges"("toId", "createdAt");

-- CreateIndex
CREATE INDEX "circle_nudges_fromId_toId_createdAt_idx" ON "public"."circle_nudges"("fromId", "toId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."circle_members" ADD CONSTRAINT "circle_members_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "public"."circles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."circle_members" ADD CONSTRAINT "circle_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."circle_members" ADD CONSTRAINT "circle_members_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."circle_nudges" ADD CONSTRAINT "circle_nudges_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "public"."circles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."circle_nudges" ADD CONSTRAINT "circle_nudges_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."circle_nudges" ADD CONSTRAINT "circle_nudges_toId_fkey" FOREIGN KEY ("toId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: practice circles keep their id, name, invite code and discoverability.
-- They were created by hand, so matching stays off until an owner turns it on.
INSERT INTO "public"."circles" ("id", "name", "emoji", "inviteCode", "openToMatching", "discoverable", "createdAt")
SELECT pc."id", pc."name",
       COALESCE((SELECT p."emoji" FROM "public"."practice_circle_members" m
                 JOIN "public"."plans" p ON p."id" = m."planId"
                 WHERE m."circleId" = pc."id" AND p."emoji" IS NOT NULL
                 ORDER BY m."owner" DESC, m."joinedAt" ASC LIMIT 1), '✨'),
       pc."inviteCode", false, pc."discoverable", pc."createdAt"
FROM "public"."practice_circles" pc
ON CONFLICT DO NOTHING;

INSERT INTO "public"."circle_members" ("circleId", "userId", "planId", "role", "joinedAt")
SELECT m."circleId", m."userId", m."planId",
       CASE WHEN m."owner" THEN 'OWNER'::"public"."CircleRole" ELSE 'MEMBER'::"public"."CircleRole" END,
       m."joinedAt"
FROM "public"."practice_circle_members" m
JOIN "public"."plans" p ON p."id" = m."planId" AND p."deletedAt" IS NULL AND p."archivedAt" IS NULL
ON CONFLICT DO NOTHING;

-- Backfill: plan groups with at least two active members become private circles.
INSERT INTO "public"."circles" ("id", "name", "emoji", "inviteCode", "openToMatching", "discoverable", "createdAt")
SELECT 'pg_' || g."id",
       LEFT(COALESCE(op."goal", 'Plan group'), 60),
       COALESCE(op."emoji", '✨'),
       gen_random_uuid()::text, false, false, g."createdAt"
FROM "public"."plan_groups" g
LEFT JOIN LATERAL (
  SELECT p."goal", p."emoji" FROM "public"."plan_group_members" m
  JOIN "public"."plans" p ON p."id" = m."planId"
  WHERE m."planGroupId" = g."id" AND m."status" = 'ACTIVE'
  ORDER BY (m."role" = 'OWNER') DESC, m."joinedAt" ASC NULLS LAST LIMIT 1
) op ON true
WHERE (SELECT count(*) FROM "public"."plan_group_members" m
       JOIN "public"."plans" p ON p."id" = m."planId" AND p."deletedAt" IS NULL AND p."archivedAt" IS NULL
       WHERE m."planGroupId" = g."id" AND m."status" = 'ACTIVE') >= 2
ON CONFLICT DO NOTHING;

INSERT INTO "public"."circle_members" ("circleId", "userId", "planId", "role", "joinedAt")
SELECT 'pg_' || m."planGroupId", m."userId", m."planId",
       CASE WHEN m."role" = 'OWNER' THEN 'OWNER'::"public"."CircleRole" ELSE 'MEMBER'::"public"."CircleRole" END,
       COALESCE(m."joinedAt", m."invitedAt")
FROM "public"."plan_group_members" m
JOIN "public"."plans" p ON p."id" = m."planId" AND p."deletedAt" IS NULL AND p."archivedAt" IS NULL
WHERE m."status" = 'ACTIVE'
  AND EXISTS (SELECT 1 FROM "public"."circles" c WHERE c."id" = 'pg_' || m."planGroupId")
ON CONFLICT DO NOTHING;

-- Every circle needs an owner: promote the earliest member where none was carried over.
UPDATE "public"."circle_members" cm SET "role" = 'OWNER'
WHERE NOT EXISTS (SELECT 1 FROM "public"."circle_members" o WHERE o."circleId" = cm."circleId" AND o."role" = 'OWNER')
  AND cm."userId" = (SELECT f."userId" FROM "public"."circle_members" f WHERE f."circleId" = cm."circleId" ORDER BY f."joinedAt" ASC, f."userId" ASC LIMIT 1);

-- Drop circles that ended up empty, then mark circles with 3+ members as active.
DELETE FROM "public"."circles" c WHERE NOT EXISTS (SELECT 1 FROM "public"."circle_members" m WHERE m."circleId" = c."id");
UPDATE "public"."circles" c SET "status" = 'ACTIVE'
WHERE (SELECT count(*) FROM "public"."circle_members" m WHERE m."circleId" = c."id") >= 3;
