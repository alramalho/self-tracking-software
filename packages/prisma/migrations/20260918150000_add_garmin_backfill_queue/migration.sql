ALTER TABLE "public"."garmin_integrations"
  ADD COLUMN "backfillTargetStartSeconds" INTEGER,
  ADD COLUMN "backfillCursorSeconds" INTEGER,
  ADD COLUMN "backfillSummaryType" TEXT;
