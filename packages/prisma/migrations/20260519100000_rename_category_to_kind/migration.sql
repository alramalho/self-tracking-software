ALTER TABLE "public"."activities" RENAME COLUMN "category" TO "kind";

DROP INDEX IF EXISTS "public"."activities_userId_category_deletedAt_idx";
CREATE INDEX "activities_userId_kind_deletedAt_idx"
  ON "public"."activities"("userId", "kind", "deletedAt");
