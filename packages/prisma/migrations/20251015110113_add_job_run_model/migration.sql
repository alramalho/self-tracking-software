-- CreateEnum
CREATE TYPE "public"."JobType" AS ENUM ('HOURLY', 'DAILY');

-- CreateTable
CREATE TABLE "public"."job_runs" (
    "id" TEXT NOT NULL,
    "jobType" "public"."JobType" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "success" BOOLEAN NOT NULL DEFAULT false,
    "input" JSONB,
    "output" JSONB,
    "errorMessage" TEXT,
    "errorStack" TEXT,
    "triggeredBy" TEXT NOT NULL DEFAULT 'CRON',

    CONSTRAINT "job_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "job_runs_jobType_startedAt_idx" ON "public"."job_runs"("jobType", "startedAt");

-- CreateIndex
CREATE INDEX "job_runs_success_idx" ON "public"."job_runs"("success");

-- CreateIndex
CREATE INDEX "job_runs_startedAt_idx" ON "public"."job_runs"("startedAt");
