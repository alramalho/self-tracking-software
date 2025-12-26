-- CreateEnum
CREATE TYPE "public"."MessageStatus" AS ENUM ('SENT', 'READ');

-- AlterTable
ALTER TABLE "public"."messages" ADD COLUMN "status" "public"."MessageStatus" NOT NULL DEFAULT 'SENT';
