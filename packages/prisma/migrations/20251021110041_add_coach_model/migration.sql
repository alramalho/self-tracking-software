-- CreateTable
CREATE TABLE "public"."coaches" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coaches_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "public"."plans" ADD COLUMN "coachId" TEXT;

-- AlterTable
ALTER TABLE "public"."messages" ADD COLUMN "coachId" TEXT,
ADD COLUMN "planId" TEXT;

-- AlterEnum
-- Rename ASSISTANT to COACH in MessageRole enum
ALTER TYPE "public"."MessageRole" RENAME VALUE 'ASSISTANT' TO 'COACH';

-- CreateIndex
CREATE INDEX "coaches_ownerId_idx" ON "public"."coaches"("ownerId");

-- CreateIndex
CREATE INDEX "messages_coachId_idx" ON "public"."messages"("coachId");

-- CreateIndex
CREATE INDEX "messages_planId_idx" ON "public"."messages"("planId");

-- AddForeignKey
ALTER TABLE "public"."coaches" ADD CONSTRAINT "coaches_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."plans" ADD CONSTRAINT "plans_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "public"."coaches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."messages" ADD CONSTRAINT "messages_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "public"."coaches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."messages" ADD CONSTRAINT "messages_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
