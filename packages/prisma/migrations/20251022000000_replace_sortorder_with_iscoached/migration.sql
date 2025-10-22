-- AlterTable
ALTER TABLE "public"."plans" DROP COLUMN "sortOrder";

-- AlterTable
ALTER TABLE "public"."plans" ADD COLUMN "isCoached" BOOLEAN NOT NULL DEFAULT false;
