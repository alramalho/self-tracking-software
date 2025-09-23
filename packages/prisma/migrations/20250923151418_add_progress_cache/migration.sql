-- AlterTable
ALTER TABLE "public"."plans" ADD COLUMN     "progressCalculatedAt" TIMESTAMP(3),
ADD COLUMN     "progressState" JSONB;
