/*
  Warnings:

  - You are about to drop the `PlanMilestone` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."PlanMilestone" DROP CONSTRAINT "PlanMilestone_planId_fkey";

-- AlterTable
ALTER TABLE "public"."_ActivityToPlan" ADD CONSTRAINT "_ActivityToPlan_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "public"."_ActivityToPlan_AB_unique";

-- AlterTable
ALTER TABLE "public"."_PlanGroupToUser" ADD CONSTRAINT "_PlanGroupToUser_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "public"."_PlanGroupToUser_AB_unique";

-- AlterTable
ALTER TABLE "public"."_UserFriends" ADD CONSTRAINT "_UserFriends_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "public"."_UserFriends_AB_unique";

-- DropTable
DROP TABLE "public"."PlanMilestone";

-- CreateTable
CREATE TABLE "public"."plan_milestones" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "progress" INTEGER,
    "criteria" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_milestones_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."plan_milestones" ADD CONSTRAINT "plan_milestones_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
