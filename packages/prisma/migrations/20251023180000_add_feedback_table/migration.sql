-- CreateEnum for FeedbackCategory
CREATE TYPE "public"."FeedbackCategory" AS ENUM ('BUG', 'FEATURE_REQUEST', 'QUESTION', 'AI_MESSAGE_FEEDBACK', 'AI_OVERALL_FEEDBACK', 'TESTIMONIAL');

-- CreateTable
CREATE TABLE "public"."feedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "public"."FeedbackCategory" NOT NULL,
    "content" TEXT,
    "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feedback_userId_idx" ON "public"."feedback"("userId");

-- CreateIndex
CREATE INDEX "feedback_category_idx" ON "public"."feedback"("category");

-- CreateIndex
CREATE INDEX "feedback_createdAt_idx" ON "public"."feedback"("createdAt");

-- AddForeignKey
ALTER TABLE "public"."feedback" ADD CONSTRAINT "feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
