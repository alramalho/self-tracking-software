/*
  Warnings:

  - You are about to drop the column `recipientId` on the `messages` table. All the data in the column will be lost.
  - You are about to drop the column `recipientName` on the `messages` table. All the data in the column will be lost.
  - You are about to drop the column `senderId` on the `messages` table. All the data in the column will be lost.
  - You are about to drop the column `senderName` on the `messages` table. All the data in the column will be lost.
  - You are about to drop the column `text` on the `messages` table. All the data in the column will be lost.
  - Added the required column `content` to the `messages` table without a default value. This is not possible if the table is not empty.
  - Added the required column `role` to the `messages` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `messages` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('USER', 'ASSISTANT');

-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_recipientId_fkey";

-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_senderId_fkey";

-- AlterTable
ALTER TABLE "activity_entries" ADD COLUMN     "reactions" JSONB DEFAULT '{}';

-- AlterTable
ALTER TABLE "messages" DROP COLUMN "recipientId",
DROP COLUMN "recipientName",
DROP COLUMN "senderId",
DROP COLUMN "senderName",
DROP COLUMN "text",
ADD COLUMN     "content" TEXT NOT NULL,
ADD COLUMN     "role" "MessageRole" NOT NULL,
ADD COLUMN     "userId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
