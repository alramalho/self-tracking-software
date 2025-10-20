-- Rename enum
ALTER TYPE "ActivityVisibility" RENAME TO "Visibility";

-- AlterTable
ALTER TABLE "plans" ADD COLUMN "visibility" "Visibility" NOT NULL DEFAULT 'PUBLIC';

-- AlterTable - Remove deprecated activity privacy fields
ALTER TABLE "activities" DROP COLUMN IF EXISTS "privacySettings";

-- AlterTable - Remove deprecated user default activity visibility
ALTER TABLE "users" DROP COLUMN IF EXISTS "defaultActivityVisibility";

-- Drop deprecated index on activities
DROP INDEX IF EXISTS "activities_deletedAt_privacySettings_idx";
