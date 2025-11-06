-- Rename 'date' column to 'datetime' and change type from date to timestamp
-- Existing date values will automatically get 00:00:00 time component added
ALTER TABLE "public"."activity_entries"
  RENAME COLUMN "date" TO "datetime";

-- Change column type from date to timestamp (no timezone)
ALTER TABLE "public"."activity_entries"
  ALTER COLUMN "datetime" TYPE timestamp;
