/*
  Warnings:

  - You are about to drop the column `reactions` on the `activity_entries` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "comments" DROP CONSTRAINT "comments_userId_fkey";

-- DropForeignKey
ALTER TABLE "reactions" DROP CONSTRAINT "reactions_userId_fkey";

-- AlterTable
ALTER TABLE "activity_entries" DROP COLUMN "reactions";
