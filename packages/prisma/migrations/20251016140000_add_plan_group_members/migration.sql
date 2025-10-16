-- CreateEnum
CREATE TYPE "public"."PlanGroupRole" AS ENUM ('OWNER', 'MEMBER');

-- CreateEnum
CREATE TYPE "public"."PlanGroupStatus" AS ENUM ('INVITED', 'ACTIVE', 'LEFT', 'REJECTED');

-- CreateTable
CREATE TABLE "public"."plan_group_members" (
    "id" TEXT NOT NULL,
    "planGroupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT,
    "role" "public"."PlanGroupRole" NOT NULL DEFAULT 'MEMBER',
    "status" "public"."PlanGroupStatus" NOT NULL DEFAULT 'INVITED',
    "invitedById" TEXT,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joinedAt" TIMESTAMP(3),
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "plan_group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."plan_invite_links" (
    "id" TEXT NOT NULL,
    "planGroupId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "maxUses" INTEGER DEFAULT 0,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_invite_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plan_group_members_planGroupId_userId_key" ON "public"."plan_group_members"("planGroupId", "userId");

-- CreateIndex
CREATE INDEX "plan_group_members_userId_status_idx" ON "public"."plan_group_members"("userId", "status");

-- CreateIndex
CREATE INDEX "plan_group_members_planGroupId_status_idx" ON "public"."plan_group_members"("planGroupId", "status");

-- CreateIndex
CREATE INDEX "plan_invite_links_planGroupId_isActive_idx" ON "public"."plan_invite_links"("planGroupId", "isActive");

-- AddForeignKey
ALTER TABLE "public"."plan_group_members" ADD CONSTRAINT "plan_group_members_planGroupId_fkey" FOREIGN KEY ("planGroupId") REFERENCES "public"."plan_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."plan_group_members" ADD CONSTRAINT "plan_group_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."plan_group_members" ADD CONSTRAINT "plan_group_members_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."plan_group_members" ADD CONSTRAINT "plan_group_members_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."plan_invite_links" ADD CONSTRAINT "plan_invite_links_planGroupId_fkey" FOREIGN KEY ("planGroupId") REFERENCES "public"."plan_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."plan_invite_links" ADD CONSTRAINT "plan_invite_links_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing plan group members from implicit _PlanGroupToUser table to explicit plan_group_members
-- For each user in a plan group, create a member record and link their plan if it exists
INSERT INTO "public"."plan_group_members" ("id", "planGroupId", "userId", "planId", "role", "status", "joinedAt")
SELECT
    gen_random_uuid()::text,
    pgt."A" as "planGroupId",
    pgt."B" as "userId",
    p."id" as "planId",
    'OWNER'::"public"."PlanGroupRole" as "role",
    'ACTIVE'::"public"."PlanGroupStatus" as "status",
    CURRENT_TIMESTAMP as "joinedAt"
FROM "public"."_PlanGroupToUser" pgt
LEFT JOIN "public"."plans" p ON p."userId" = pgt."B" AND p."planGroupId" = pgt."A" AND p."deletedAt" IS NULL
ON CONFLICT ("planGroupId", "userId") DO NOTHING;

-- Drop the implicit join table
DROP TABLE IF EXISTS "public"."_PlanGroupToUser";

-- Drop old plan_invitations table and enum
DROP TABLE IF EXISTS "public"."plan_invitations";
DROP TYPE IF EXISTS "public"."InvitationStatus";
