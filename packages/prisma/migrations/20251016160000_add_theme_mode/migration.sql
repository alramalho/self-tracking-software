-- CreateEnum
CREATE TYPE "public"."ThemeMode" AS ENUM ('LIGHT', 'DARK', 'AUTO');

-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN "themeMode" "public"."ThemeMode" NOT NULL DEFAULT 'LIGHT';
