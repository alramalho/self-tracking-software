-- App Store Guideline 3.1.1: coaching bought on iOS through Apple in-app purchase. Additive only.
-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN     "appleAppAccountToken" TEXT,
ADD COLUMN     "appleOriginalTransactionId" TEXT,
ADD COLUMN     "appleProductId" TEXT,
ADD COLUMN     "appleSubscriptionExpiresAt" TIMESTAMP(3),
ADD COLUMN     "appleSubscriptionStatus" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_appleAppAccountToken_key" ON "public"."users"("appleAppAccountToken");

-- CreateIndex
CREATE UNIQUE INDEX "users_appleOriginalTransactionId_key" ON "public"."users"("appleOriginalTransactionId");
