-- Add pause-related columns to plans table for the pause/resume feature
ALTER TABLE "public"."plans" ADD COLUMN IF NOT EXISTS "isPaused" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "public"."plans" ADD COLUMN IF NOT EXISTS "pauseReason" TEXT;
ALTER TABLE "public"."plans" ADD COLUMN IF NOT EXISTS "pauseHistory" JSONB;
11