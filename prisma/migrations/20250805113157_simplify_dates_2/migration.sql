-- AlterTable
ALTER TABLE "activity_entries" ALTER COLUMN "date" SET DATA TYPE DATE;

-- AlterTable
ALTER TABLE "metric_entries" ALTER COLUMN "date" SET DATA TYPE DATE;

-- AlterTable
ALTER TABLE "mood_reports" ALTER COLUMN "date" SET DATA TYPE DATE;

-- AlterTable
ALTER TABLE "plan_milestones" ALTER COLUMN "date" SET DATA TYPE DATE;

-- AlterTable
ALTER TABLE "plan_sessions" ALTER COLUMN "date" SET DATA TYPE DATE;

-- AlterTable
ALTER TABLE "plans" ALTER COLUMN "finishingDate" SET DATA TYPE DATE;
