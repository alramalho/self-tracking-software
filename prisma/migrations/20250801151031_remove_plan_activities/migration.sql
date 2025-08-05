/*
  Warnings:

  - You are about to drop the `plan_activities` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "plan_activities" DROP CONSTRAINT "plan_activities_activityId_fkey";

-- DropForeignKey
ALTER TABLE "plan_activities" DROP CONSTRAINT "plan_activities_planId_fkey";

-- DropTable
DROP TABLE "plan_activities";

-- CreateTable
CREATE TABLE "_ActivityToPlan" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_ActivityToPlan_AB_unique" ON "_ActivityToPlan"("A", "B");

-- CreateIndex
CREATE INDEX "_ActivityToPlan_B_index" ON "_ActivityToPlan"("B");

-- AddForeignKey
ALTER TABLE "_ActivityToPlan" ADD CONSTRAINT "_ActivityToPlan_A_fkey" FOREIGN KEY ("A") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ActivityToPlan" ADD CONSTRAINT "_ActivityToPlan_B_fkey" FOREIGN KEY ("B") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
