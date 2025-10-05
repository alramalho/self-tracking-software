-- @param {String} $1:planId - The plan ID to exclude from results
-- @param {String} $2:embedding - The embedding vector as a JSON string
-- @param {Json} $3:userIds - Array of user IDs to filter by (pass as text[] in Postgres)
-- @param {Int} $4:limit - Maximum number of results to return

SELECT
  id as "planId",
  goal,
  "userId",
  emoji,
  "createdAt",
  "updatedAt",
  "deletedAt",
  "finishingDate",
  (1 - (embedding <=> $2::vector)) as similarity
FROM plans
WHERE "deletedAt" IS NULL
  AND ("finishingDate" IS NULL OR "finishingDate" > NOW())
  AND embedding IS NOT NULL
  AND id != $1
  AND "userId" = ANY($3::text[])
ORDER BY embedding <=> $2::vector ASC
LIMIT $4;


