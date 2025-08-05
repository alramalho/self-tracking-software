/*
  Warnings:

  - The primary key for the `_ActivityToPlan` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `_PlanGroupToUser` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `_UserFriends` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `deleted` on the `users` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[A,B]` on the table `_ActivityToPlan` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[A,B]` on the table `_PlanGroupToUser` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[A,B]` on the table `_UserFriends` will be added. If there are existing duplicate values, this will fail.
  - Changed the type of `date` on the `activity_entries` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `date` on the `metric_entries` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `date` on the `mood_reports` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `date` on the `plan_milestones` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `date` on the `plan_sessions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "_ActivityToPlan" DROP CONSTRAINT "_ActivityToPlan_AB_pkey";

-- AlterTable
ALTER TABLE "_PlanGroupToUser" DROP CONSTRAINT "_PlanGroupToUser_AB_pkey";

-- AlterTable
ALTER TABLE "_UserFriends" DROP CONSTRAINT "_UserFriends_AB_pkey";

-- AlterTable
ALTER TABLE "activity_entries" DROP COLUMN "date",
ADD COLUMN     "date" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "metric_entries" DROP COLUMN "date",
ADD COLUMN     "date" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "mood_reports" DROP COLUMN "date",
ADD COLUMN     "date" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "plan_milestones" DROP COLUMN "date",
ADD COLUMN     "date" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "plan_sessions" DROP COLUMN "date",
ADD COLUMN     "date" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "deleted";

-- CreateIndex
CREATE UNIQUE INDEX "_ActivityToPlan_AB_unique" ON "_ActivityToPlan"("A", "B");

-- CreateIndex
CREATE UNIQUE INDEX "_PlanGroupToUser_AB_unique" ON "_PlanGroupToUser"("A", "B");

-- CreateIndex
CREATE UNIQUE INDEX "_UserFriends_AB_unique" ON "_UserFriends"("A", "B");
