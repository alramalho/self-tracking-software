CREATE TABLE "public"."account_switch_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_switch_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "account_switch_tokens_tokenHash_key" ON "public"."account_switch_tokens"("tokenHash");

CREATE INDEX "account_switch_tokens_userId_idx" ON "public"."account_switch_tokens"("userId");

ALTER TABLE "public"."account_switch_tokens" ADD CONSTRAINT "account_switch_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
