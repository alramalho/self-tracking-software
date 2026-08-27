DROP INDEX IF EXISTS "users_supabaseAuthId_key";
ALTER TABLE "users" DROP COLUMN IF EXISTS "supabaseAuthId";
