-- -- -- Migration: add_supabase_auth_id
-- -- -- Add supabaseAuthId column to users table

ALTER TABLE users ADD COLUMN "supabaseAuthId" TEXT;
CREATE UNIQUE INDEX "users_supabaseAuthId_key" ON users("supabaseAuthId");
