-- CreateEnum
CREATE TYPE "public"."AchievementType" AS ENUM ('STREAK', 'HABIT', 'LIFESTYLE');

-- CreateTable
CREATE TABLE "public"."achievement_posts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "achievementType" "public"."AchievementType" NOT NULL,
    "streakNumber" INTEGER,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "achievement_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."achievement_images" (
    "id" TEXT NOT NULL,
    "achievementPostId" TEXT NOT NULL,
    "s3Path" TEXT NOT NULL,
    "url" TEXT,
    "expiresAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "achievement_images_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "public"."reactions"
  ALTER COLUMN "activityEntryId" DROP NOT NULL,
  ADD COLUMN "achievementPostId" TEXT;

-- AlterTable
ALTER TABLE "public"."comments"
  ALTER COLUMN "activityEntryId" DROP NOT NULL,
  ADD COLUMN "achievementPostId" TEXT;

-- CreateIndex
CREATE INDEX "achievement_posts_userId_deletedAt_idx" ON "public"."achievement_posts"("userId", "deletedAt");

-- CreateIndex
CREATE INDEX "achievement_posts_planId_idx" ON "public"."achievement_posts"("planId");

-- CreateIndex
CREATE INDEX "achievement_posts_createdAt_idx" ON "public"."achievement_posts"("createdAt");

-- CreateIndex
CREATE INDEX "achievement_posts_deletedAt_createdAt_idx" ON "public"."achievement_posts"("deletedAt", "createdAt");

-- CreateIndex
CREATE INDEX "achievement_images_achievementPostId_sortOrder_idx" ON "public"."achievement_images"("achievementPostId", "sortOrder");

-- CreateIndex
CREATE INDEX "reactions_achievementPostId_idx" ON "public"."reactions"("achievementPostId");

-- CreateIndex
CREATE UNIQUE INDEX "reactions_achievementPostId_userId_emoji_key" ON "public"."reactions"("achievementPostId", "userId", "emoji");

-- CreateIndex
CREATE INDEX "comments_achievementPostId_deletedAt_idx" ON "public"."comments"("achievementPostId", "deletedAt");

-- AddForeignKey
ALTER TABLE "public"."reactions" ADD CONSTRAINT "reactions_achievementPostId_fkey" FOREIGN KEY ("achievementPostId") REFERENCES "public"."achievement_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."comments" ADD CONSTRAINT "comments_achievementPostId_fkey" FOREIGN KEY ("achievementPostId") REFERENCES "public"."achievement_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."achievement_posts" ADD CONSTRAINT "achievement_posts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."achievement_posts" ADD CONSTRAINT "achievement_posts_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."achievement_images" ADD CONSTRAINT "achievement_images_achievementPostId_fkey" FOREIGN KEY ("achievementPostId") REFERENCES "public"."achievement_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
