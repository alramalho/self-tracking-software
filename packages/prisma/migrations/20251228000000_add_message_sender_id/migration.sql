-- Add senderId to messages table
ALTER TABLE "public"."messages" ADD COLUMN "senderId" TEXT;

-- Add foreign key constraint
ALTER TABLE "public"."messages" ADD CONSTRAINT "messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add index for performance
CREATE INDEX "messages_senderId_idx" ON "public"."messages"("senderId");
