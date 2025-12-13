-- Add internalNotes column to plans table for storing AI-generated guidelines
ALTER TABLE "public"."plans" ADD COLUMN IF NOT EXISTS "internalNotes" TEXT;

-- Add estimatedWeeks column to plans table for storing estimated duration to achieve goal
ALTER TABLE "public"."plans" ADD COLUMN IF NOT EXISTS "estimatedWeeks" INTEGER;
