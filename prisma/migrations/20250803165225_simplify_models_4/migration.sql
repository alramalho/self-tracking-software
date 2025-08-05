/*
  Warnings:

  - You are about to drop the column `planId` on the `activities` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "activities" DROP CONSTRAINT "activities_planId_fkey";

-- AlterTable
ALTER TABLE "activities" DROP COLUMN "planId";

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
