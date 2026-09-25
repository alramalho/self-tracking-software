-- App Store Guideline 1.2: user reports, user blocks and moderator-removed messages. Additive only.
-- CreateEnum
CREATE TYPE "public"."ContentReportKind" AS ENUM ('USER', 'MESSAGE', 'COMMENT', 'ACTIVITY_ENTRY', 'ACHIEVEMENT_POST', 'CIRCLE');

-- CreateEnum
CREATE TYPE "public"."ContentReportReason" AS ENUM ('SPAM', 'HARASSMENT', 'HATE', 'SEXUAL', 'SELF_HARM', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."ContentReportStatus" AS ENUM ('OPEN', 'ACTIONED', 'DISMISSED');

-- AlterTable
ALTER TABLE "public"."messages" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "public"."content_reports" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "kind" "public"."ContentReportKind" NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" "public"."ContentReportReason" NOT NULL,
    "note" TEXT,
    "snapshot" JSONB,
    "status" "public"."ContentReportStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "content_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_blocks" (
    "id" TEXT NOT NULL,
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "content_reports_status_createdAt_idx" ON "public"."content_reports"("status", "createdAt");

-- CreateIndex
CREATE INDEX "content_reports_targetUserId_idx" ON "public"."content_reports"("targetUserId");

-- CreateIndex
CREATE INDEX "user_blocks_blockedId_idx" ON "public"."user_blocks"("blockedId");

-- CreateIndex
CREATE UNIQUE INDEX "user_blocks_blockerId_blockedId_key" ON "public"."user_blocks"("blockerId", "blockedId");

-- AddForeignKey
ALTER TABLE "public"."content_reports" ADD CONSTRAINT "content_reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."content_reports" ADD CONSTRAINT "content_reports_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_blocks" ADD CONSTRAINT "user_blocks_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_blocks" ADD CONSTRAINT "user_blocks_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

