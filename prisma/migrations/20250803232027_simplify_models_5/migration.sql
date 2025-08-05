/*
  Warnings:

  - The `finishingDate` column on the `plans` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- DropForeignKey
ALTER TABLE "plan_sessions" DROP CONSTRAINT "plan_sessions_coach_plan_fkey";

-- AlterTable
ALTER TABLE "plans" DROP COLUMN "finishingDate",
ADD COLUMN     "finishingDate" TIMESTAMP(3);
