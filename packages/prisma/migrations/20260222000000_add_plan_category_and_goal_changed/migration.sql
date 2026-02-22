-- AlterTable
ALTER TABLE "public"."plans" ADD COLUMN "category" TEXT;
ALTER TABLE "public"."plans" ADD COLUMN "goalChanged" BOOLEAN NOT NULL DEFAULT true;
