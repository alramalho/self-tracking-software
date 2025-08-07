/*
  Warnings:

  - You are about to drop the `mood_reports` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "mood_reports" DROP CONSTRAINT "mood_reports_userId_fkey";

-- DropTable
DROP TABLE "mood_reports";

-- CreateIndex
CREATE INDEX "activities_userId_deletedAt_idx" ON "activities"("userId", "deletedAt");

-- CreateIndex
CREATE INDEX "activities_deletedAt_privacySettings_idx" ON "activities"("deletedAt", "privacySettings");

-- CreateIndex
CREATE INDEX "activities_createdAt_idx" ON "activities"("createdAt");

-- CreateIndex
CREATE INDEX "activity_entries_userId_deletedAt_idx" ON "activity_entries"("userId", "deletedAt");

-- CreateIndex
CREATE INDEX "activity_entries_deletedAt_createdAt_idx" ON "activity_entries"("deletedAt", "createdAt");

-- CreateIndex
CREATE INDEX "activity_entries_activityId_idx" ON "activity_entries"("activityId");

-- CreateIndex
CREATE INDEX "activity_entries_createdAt_idx" ON "activity_entries"("createdAt");

-- CreateIndex
CREATE INDEX "comments_activityEntryId_deletedAt_idx" ON "comments"("activityEntryId", "deletedAt");

-- CreateIndex
CREATE INDEX "comments_createdAt_idx" ON "comments"("createdAt");

-- CreateIndex
CREATE INDEX "messages_userId_idx" ON "messages"("userId");

-- CreateIndex
CREATE INDEX "messages_createdAt_idx" ON "messages"("createdAt");

-- CreateIndex
CREATE INDEX "metric_entries_userId_idx" ON "metric_entries"("userId");

-- CreateIndex
CREATE INDEX "metric_entries_metricId_idx" ON "metric_entries"("metricId");

-- CreateIndex
CREATE INDEX "metric_entries_createdAt_idx" ON "metric_entries"("createdAt");

-- CreateIndex
CREATE INDEX "metrics_userId_idx" ON "metrics"("userId");

-- CreateIndex
CREATE INDEX "metrics_createdAt_idx" ON "metrics"("createdAt");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "notifications"("createdAt");

-- CreateIndex
CREATE INDEX "plan_milestones_planId_idx" ON "plan_milestones"("planId");

-- CreateIndex
CREATE INDEX "plan_sessions_planId_idx" ON "plan_sessions"("planId");

-- CreateIndex
CREATE INDEX "plan_sessions_planId_isCoachSuggested_idx" ON "plan_sessions"("planId", "isCoachSuggested");

-- CreateIndex
CREATE INDEX "plan_sessions_activityId_idx" ON "plan_sessions"("activityId");

-- CreateIndex
CREATE INDEX "plans_userId_deletedAt_idx" ON "plans"("userId", "deletedAt");

-- CreateIndex
CREATE INDEX "plans_userId_id_idx" ON "plans"("userId", "id");

-- CreateIndex
CREATE INDEX "plans_createdAt_idx" ON "plans"("createdAt");

-- CreateIndex
CREATE INDEX "reactions_activityEntryId_idx" ON "reactions"("activityEntryId");
