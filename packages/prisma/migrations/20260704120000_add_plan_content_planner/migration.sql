-- CreateEnum
CREATE TYPE "public"."ContentPlanner" AS ENUM ('COACH', 'EXTERNAL_AGENT');

-- AlterTable
ALTER TABLE "public"."plans" ADD COLUMN "contentPlanner" "public"."ContentPlanner" NOT NULL DEFAULT 'COACH';
ALTER TABLE "public"."plans" ADD COLUMN "externalAgentLastSyncAt" TIMESTAMP(3);
