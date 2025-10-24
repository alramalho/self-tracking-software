-- Drop the message_feedback table
-- (No data migration needed as per user request)
DROP TABLE IF EXISTS "public"."message_feedback";

-- Add messageId column to feedback table
ALTER TABLE "public"."feedback" ADD COLUMN "messageId" TEXT;

-- Create index on messageId
CREATE INDEX "feedback_messageId_idx" ON "public"."feedback"("messageId");

-- Add foreign key constraint
ALTER TABLE "public"."feedback" ADD CONSTRAINT "feedback_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "public"."messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
