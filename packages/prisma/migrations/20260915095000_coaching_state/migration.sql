CREATE TABLE "public"."coaching_state" (
  "userId" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "coaching_state_pkey" PRIMARY KEY ("userId"),
  CONSTRAINT "coaching_state_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
