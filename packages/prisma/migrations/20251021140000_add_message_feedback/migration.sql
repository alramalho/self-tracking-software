-- CreateEnum
CREATE TYPE "public"."FeedbackType" AS ENUM ('POSITIVE', 'NEGATIVE');

-- CreateTable
CREATE TABLE "public"."message_feedback" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "feedbackType" "public"."FeedbackType" NOT NULL,
    "feedbackReasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "additionalComments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "message_feedback_messageId_idx" ON "public"."message_feedback"("messageId");

-- CreateIndex
CREATE INDEX "message_feedback_userId_idx" ON "public"."message_feedback"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "message_feedback_messageId_userId_key" ON "public"."message_feedback"("messageId", "userId");

-- AddForeignKey
ALTER TABLE "public"."message_feedback" ADD CONSTRAINT "message_feedback_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "public"."messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."message_feedback" ADD CONSTRAINT "message_feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
