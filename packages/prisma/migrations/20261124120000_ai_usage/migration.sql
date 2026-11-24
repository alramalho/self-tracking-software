-- Fair use of AI features: how many AI uses each person made in a calendar month.
CREATE TABLE IF NOT EXISTS "public"."ai_usage" (
    "userId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("userId","month")
);
ALTER TABLE "public"."ai_usage" DROP CONSTRAINT IF EXISTS "ai_usage_userId_fkey";
ALTER TABLE "public"."ai_usage" ADD CONSTRAINT "ai_usage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
