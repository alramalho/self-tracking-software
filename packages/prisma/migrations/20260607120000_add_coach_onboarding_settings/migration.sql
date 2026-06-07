ALTER TABLE "public"."users"
ADD COLUMN "coachOnboardingCompletedAt" TIMESTAMP(3),
ADD COLUMN "proactiveCoachingEnabled" BOOLEAN NOT NULL DEFAULT true;

UPDATE "public"."users"
SET "coachOnboardingCompletedAt" = NOW()
WHERE "planType" = 'PLUS'
AND "coachOnboardingCompletedAt" IS NULL;
