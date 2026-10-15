-- How sure the person was of a designed plan (1–10) and, in their own words, why it wasn't lower.
ALTER TABLE "public"."plans" ADD COLUMN "confidence" JSONB;
