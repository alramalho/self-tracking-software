-- Add celebratedLevelThreshold to users table
ALTER TABLE "public"."users" ADD COLUMN "celebratedLevelThreshold" INTEGER;

-- Add LEVEL_UP to AchievementType enum
ALTER TYPE "public"."AchievementType" ADD VALUE 'LEVEL_UP';

-- Make planId optional on achievement_posts
ALTER TABLE "public"."achievement_posts" ALTER COLUMN "planId" DROP NOT NULL;

-- Add levelName column for level-up achievements
ALTER TABLE "public"."achievement_posts" ADD COLUMN "levelName" TEXT;
