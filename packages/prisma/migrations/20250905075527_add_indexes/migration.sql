-- CreateIndex
CREATE INDEX "metric_entries_userId_date_idx" ON "public"."metric_entries"("userId", "date");

-- CreateIndex
CREATE INDEX "metric_entries_metricId_date_idx" ON "public"."metric_entries"("metricId", "date");

-- CreateIndex
CREATE INDEX "plan_sessions_planId_isCoachSuggested_date_idx" ON "public"."plan_sessions"("planId", "isCoachSuggested", "date");
