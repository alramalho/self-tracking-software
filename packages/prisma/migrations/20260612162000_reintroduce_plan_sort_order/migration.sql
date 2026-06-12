-- Reintroduce a per-user display order for plans. Backfill using the current
-- newest-first order so existing users do not see their plans reshuffled.
ALTER TABLE "public"."plans" ADD COLUMN "sortOrder" INTEGER;

WITH ordered_plans AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "userId"
      ORDER BY "createdAt" DESC
    ) - 1 AS "newSortOrder"
  FROM "public"."plans"
  WHERE "deletedAt" IS NULL
)
UPDATE "public"."plans"
SET "sortOrder" = ordered_plans."newSortOrder"
FROM ordered_plans
WHERE "public"."plans"."id" = ordered_plans."id";

CREATE INDEX "plans_userId_deletedAt_sortOrder_idx"
  ON "public"."plans"("userId", "deletedAt", "sortOrder");
