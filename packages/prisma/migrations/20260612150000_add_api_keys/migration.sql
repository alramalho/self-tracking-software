CREATE TABLE "public"."api_keys" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "keyHash" TEXT NOT NULL,
  "label" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),

  CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "api_keys_keyHash_key" ON "public"."api_keys"("keyHash");
CREATE INDEX "api_keys_userId_idx" ON "public"."api_keys"("userId");

ALTER TABLE "public"."api_keys"
ADD CONSTRAINT "api_keys_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "public"."users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
