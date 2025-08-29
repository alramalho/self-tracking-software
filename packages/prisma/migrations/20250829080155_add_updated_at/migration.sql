/*
  Warnings:

  - Added the required column `updatedAt` to the `activities` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `activity_entries` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `plans` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."_ActivityToPlan" ADD CONSTRAINT "_ActivityToPlan_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "public"."_ActivityToPlan_AB_unique";

-- AlterTable
ALTER TABLE "public"."_PlanGroupToUser" ADD CONSTRAINT "_PlanGroupToUser_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "public"."_PlanGroupToUser_AB_unique";

-- AlterTable
ALTER TABLE "public"."activities" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "public"."activity_entries" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "public"."plans" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
