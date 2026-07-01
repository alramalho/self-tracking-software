ALTER TABLE "public"."users"
ADD COLUMN "onboardingProgress" JSONB,
ADD COLUMN "onboardingProgressUpdatedAt" TIMESTAMP(3);
