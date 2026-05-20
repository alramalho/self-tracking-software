-- CreateEnum
CREATE TYPE "public"."CoachPersonality" AS ENUM ('CHAMPION', 'STRATEGIST');

-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN "coachPersonality" "public"."CoachPersonality" NOT NULL DEFAULT 'CHAMPION';
