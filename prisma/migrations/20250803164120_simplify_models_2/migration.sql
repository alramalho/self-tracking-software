/*
  Warnings:

  - You are about to drop the `_ActivityToPlan` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `plan_group_members` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `plan_milestone_criteria` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `plan_milestone_criteria_groups` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `plan_milestones` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `planId` to the `plan_groups` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "_ActivityToPlan" DROP CONSTRAINT "_ActivityToPlan_A_fkey";

-- DropForeignKey
ALTER TABLE "_ActivityToPlan" DROP CONSTRAINT "_ActivityToPlan_B_fkey";

-- DropForeignKey
ALTER TABLE "plan_group_members" DROP CONSTRAINT "plan_group_members_planGroupId_fkey";

-- DropForeignKey
ALTER TABLE "plan_group_members" DROP CONSTRAINT "plan_group_members_userId_fkey";

-- DropForeignKey
ALTER TABLE "plan_milestone_criteria" DROP CONSTRAINT "plan_milestone_criteria_activityId_fkey";

-- DropForeignKey
ALTER TABLE "plan_milestone_criteria" DROP CONSTRAINT "plan_milestone_criteria_groupId_fkey";

-- DropForeignKey
ALTER TABLE "plan_milestone_criteria" DROP CONSTRAINT "plan_milestone_criteria_milestoneId_fkey";

-- DropForeignKey
ALTER TABLE "plan_milestone_criteria_groups" DROP CONSTRAINT "plan_milestone_criteria_groups_milestoneId_fkey";

-- DropForeignKey
ALTER TABLE "plan_milestones" DROP CONSTRAINT "plan_milestones_planId_fkey";

-- AlterTable
ALTER TABLE "activities" ADD COLUMN     "planId" TEXT;

-- AlterTable
ALTER TABLE "plan_groups" ADD COLUMN     "planId" TEXT NOT NULL;

-- DropTable
DROP TABLE "_ActivityToPlan";

-- DropTable
DROP TABLE "plan_group_members";

-- DropTable
DROP TABLE "plan_milestone_criteria";

-- DropTable
DROP TABLE "plan_milestone_criteria_groups";

-- DropTable
DROP TABLE "plan_milestones";

-- CreateTable
CREATE TABLE "PlanMilestone" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "progress" INTEGER,
    "criteria" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_PlanGroupToUser" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_PlanGroupToUser_AB_unique" ON "_PlanGroupToUser"("A", "B");

-- CreateIndex
CREATE INDEX "_PlanGroupToUser_B_index" ON "_PlanGroupToUser"("B");

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanMilestone" ADD CONSTRAINT "PlanMilestone_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PlanGroupToUser" ADD CONSTRAINT "_PlanGroupToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "plan_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PlanGroupToUser" ADD CONSTRAINT "_PlanGroupToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
