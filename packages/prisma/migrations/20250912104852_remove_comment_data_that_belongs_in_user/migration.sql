/*
  Warnings:

  - You are about to drop the column `picture` on the `comments` table. All the data in the column will be lost.
  - You are about to drop the column `username` on the `comments` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."comments" DROP COLUMN "picture",
DROP COLUMN "username";
