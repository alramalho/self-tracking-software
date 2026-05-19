ALTER TABLE "public"."activities" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'other';

CREATE INDEX "activities_userId_category_deletedAt_idx"
  ON "public"."activities"("userId", "category", "deletedAt");
