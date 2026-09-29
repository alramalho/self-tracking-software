-- The weekly board now starts at 2 proven people (was 3). Data only: activate existing circles
-- that already have 2 proven members. No schema change.
UPDATE "public"."circles" c SET "status" = 'ACTIVE'
WHERE c."status" = 'FORMING'
  AND (SELECT count(*) FROM "public"."circle_members" m WHERE m."circleId" = c."id" AND m."provenAt" IS NOT NULL) >= 2;
