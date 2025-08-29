-- AlterTable
ALTER TABLE "public"."activities" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "public"."activity_entries" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "public"."plans" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
