-- Drop indexes that use the date field
DROP INDEX IF EXISTS "public"."metric_entries_userId_date_idx";
DROP INDEX IF EXISTS "public"."metric_entries_metricId_date_idx";

-- Drop the date column from metric_entries
ALTER TABLE "public"."metric_entries" DROP COLUMN "date";

-- Create new indexes using createdAt instead
CREATE INDEX IF NOT EXISTS "metric_entries_userId_createdAt_idx" ON "public"."metric_entries"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "metric_entries_metricId_createdAt_idx" ON "public"."metric_entries"("metricId", "createdAt");
