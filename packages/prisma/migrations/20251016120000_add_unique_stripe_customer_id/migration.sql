-- AlterTable
ALTER TABLE "users" ADD CONSTRAINT "users_stripeCustomerId_key" UNIQUE ("stripeCustomerId");
