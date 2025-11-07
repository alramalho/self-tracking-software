-- CreateEnum: ChatType
CREATE TYPE "public"."ChatType" AS ENUM ('COACH', 'DIRECT', 'GROUP');

-- AlterTable: chats
-- Add new columns and make existing columns nullable
ALTER TABLE "public"."chats"
  ADD COLUMN "type" "public"."ChatType" NOT NULL DEFAULT 'COACH',
  ADD COLUMN "planGroupId" TEXT,
  ALTER COLUMN "userId" DROP NOT NULL,
  ALTER COLUMN "coachId" DROP NOT NULL;

-- AddForeignKey: chats -> plan_groups
ALTER TABLE "public"."chats"
  ADD CONSTRAINT "chats_planGroupId_fkey"
  FOREIGN KEY ("planGroupId")
  REFERENCES "public"."plan_groups"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- CreateIndex: chats on planGroupId
CREATE INDEX "chats_planGroupId_idx" ON "public"."chats"("planGroupId");

-- CreateIndex: chats on type
CREATE INDEX "chats_type_idx" ON "public"."chats"("type");

-- CreateTable: chat_participants
CREATE TABLE "public"."chat_participants" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "chat_participants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: chat_participants unique constraint
CREATE UNIQUE INDEX "chat_participants_chatId_userId_key" ON "public"."chat_participants"("chatId", "userId");

-- CreateIndex: chat_participants on userId
CREATE INDEX "chat_participants_userId_idx" ON "public"."chat_participants"("userId");

-- CreateIndex: chat_participants on chatId
CREATE INDEX "chat_participants_chatId_idx" ON "public"."chat_participants"("chatId");

-- AddForeignKey: chat_participants -> chats
ALTER TABLE "public"."chat_participants"
  ADD CONSTRAINT "chat_participants_chatId_fkey"
  FOREIGN KEY ("chatId")
  REFERENCES "public"."chats"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- AddForeignKey: chat_participants -> users
ALTER TABLE "public"."chat_participants"
  ADD CONSTRAINT "chat_participants_userId_fkey"
  FOREIGN KEY ("userId")
  REFERENCES "public"."users"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- Backfill: Create chat_participants entries for existing coach chats
-- Each coach chat should have the user as a participant
INSERT INTO "public"."chat_participants" ("id", "chatId", "userId", "joinedAt")
SELECT
  gen_random_uuid(),  -- Generate a random UUID for the id
  c.id,
  c."userId",
  c."createdAt"
FROM "public"."chats" c
WHERE c."userId" IS NOT NULL;

-- Note: The backfill uses gen_random_uuid() which generates standard UUIDs, not CUIDs
-- This is acceptable for the participants table as the IDs don't need to be CUIDs
