-- Garmin OAuth2 PKCE connections (production app). Additive; OAuth1 rows keep working.
ALTER TABLE "public"."garmin_integrations"
  ADD COLUMN "oauthVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "refreshTokenEncrypted" TEXT,
  ADD COLUMN "accessTokenExpiresAt" TIMESTAMP(3),
  ALTER COLUMN "accessTokenSecretEncrypted" DROP NOT NULL;
