/*
  Warnings:

  - You are about to drop the column `awsCronjobId` on the `notifications` table. All the data in the column will be lost.
  - You are about to drop the column `recurrence` on the `notifications` table. All the data in the column will be lost.
  - You are about to drop the column `scheduledFor` on the `notifications` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "notifications" DROP COLUMN "awsCronjobId",
DROP COLUMN "recurrence",
DROP COLUMN "scheduledFor";

-- AlterTable
ALTER TABLE "plans" ADD COLUMN     "sortOrder" INTEGER;

-- DropEnum
DROP TYPE "NotificationRecurrence";
