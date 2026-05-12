-- Improve timeline pagination queries over connected users.
CREATE INDEX IF NOT EXISTS "activity_entries_userId_deletedAt_datetime_id_idx"
ON "public"."activity_entries"("userId", "deletedAt", "datetime" DESC, "id" DESC);

CREATE INDEX IF NOT EXISTS "achievement_posts_userId_deletedAt_createdAt_id_idx"
ON "public"."achievement_posts"("userId", "deletedAt", "createdAt" DESC, "id" DESC);
