-- CreateIndex
CREATE INDEX "connections_fromId_status_idx" ON "connections"("fromId", "status");

-- CreateIndex
CREATE INDEX "connections_toId_status_idx" ON "connections"("toId", "status");

-- CreateIndex
CREATE INDEX "connections_status_idx" ON "connections"("status");
