-- App Store Guideline 5.1.2(i): AI data sharing consent. Additive only; both null = never asked.
-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN     "aiConsentDeclinedAt" TIMESTAMP(3),
ADD COLUMN     "aiConsentGrantedAt" TIMESTAMP(3);
