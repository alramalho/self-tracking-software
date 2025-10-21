-- Delete all existing messages (as per user request to drop existing data)
DELETE FROM "public"."messages";

-- CreateTable
CREATE TABLE "public"."chats" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chats_userId_idx" ON "public"."chats"("userId");

-- CreateIndex
CREATE INDEX "chats_coachId_idx" ON "public"."chats"("coachId");

-- AddForeignKey
ALTER TABLE "public"."chats" ADD CONSTRAINT "chats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."chats" ADD CONSTRAINT "chats_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "public"."coaches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropForeignKey (messages)
ALTER TABLE "public"."messages" DROP CONSTRAINT IF EXISTS "messages_userId_fkey";
ALTER TABLE "public"."messages" DROP CONSTRAINT IF EXISTS "messages_coachId_fkey";

-- DropIndex (messages)
DROP INDEX IF EXISTS "public"."messages_userId_idx";
DROP INDEX IF EXISTS "public"."messages_coachId_idx";

-- AlterTable (messages) - Drop old columns
ALTER TABLE "public"."messages" DROP COLUMN IF EXISTS "userId";
ALTER TABLE "public"."messages" DROP COLUMN IF EXISTS "coachId";

-- AlterTable (messages) - Add chatId (no default needed since table is empty)
ALTER TABLE "public"."messages" ADD COLUMN "chatId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "messages_chatId_idx" ON "public"."messages"("chatId");

-- AddForeignKey
ALTER TABLE "public"."messages" ADD CONSTRAINT "messages_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "public"."chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;
