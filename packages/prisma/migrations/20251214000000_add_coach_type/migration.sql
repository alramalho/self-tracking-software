-- CreateEnum
CREATE TYPE "public"."CoachType" AS ENUM ('AI', 'HUMAN');

-- AlterTable
ALTER TABLE "public"."coaches" ADD COLUMN "type" "public"."CoachType" NOT NULL DEFAULT 'AI';
