-- @param {String} $1:planId - The plan ID to exclude from results
-- @param {String} $2:embedding - The embedding vector as a JSON string
-- @param {Int} $3:limit - Maximum number of results to return

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
ORDER BY embedding <=> $2::vector ASC
LIMIT $3;


