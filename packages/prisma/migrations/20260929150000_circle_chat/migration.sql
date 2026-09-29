-- Each circle can have one group chat. Additive only.

-- AlterTable
ALTER TABLE "public"."chats" ADD COLUMN "circleId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "chats_circleId_key" ON "public"."chats"("circleId");

-- AddForeignKey
ALTER TABLE "public"."chats" ADD CONSTRAINT "chats_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "public"."circles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
