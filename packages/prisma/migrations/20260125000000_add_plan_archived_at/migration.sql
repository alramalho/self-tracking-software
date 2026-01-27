-- AlterTable
ALTER TABLE "public"."plans" ADD COLUMN "archivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "plans_userId_deletedAt_archivedAt_idx" ON "public"."plans"("userId", "deletedAt", "archivedAt");
