-- Add difficulty column to activity_entries table
ALTER TABLE "public"."activity_entries" ADD COLUMN IF NOT EXISTS "difficulty" TEXT;
