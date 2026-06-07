ALTER TABLE "public"."users"
ADD COLUMN "coachOnboardingCompletedAt" TIMESTAMP(3),
ADD COLUMN "proactiveCoachingEnabled" BOOLEAN NOT NULL DEFAULT true;
