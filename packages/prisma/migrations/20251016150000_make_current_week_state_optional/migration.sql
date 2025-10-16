-- AlterTable
ALTER TABLE "public"."plans" ALTER COLUMN "currentWeekState" DROP NOT NULL,
                               ALTER COLUMN "currentWeekState" DROP DEFAULT;
