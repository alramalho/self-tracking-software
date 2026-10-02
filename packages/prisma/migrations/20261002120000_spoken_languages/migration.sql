-- Languages each person speaks, so speech to text knows what to listen for.
ALTER TABLE "public"."users" ADD COLUMN "spokenLanguages" TEXT[] DEFAULT ARRAY[]::TEXT[];
-- Thumbs up or down on a dictation result, kept in the shared feedback table.
ALTER TYPE "public"."FeedbackCategory" ADD VALUE 'TRANSCRIPTION_FEEDBACK';
