import { createHash, randomBytes } from "node:crypto";

import { GarminApiError } from "./oauth";
import type { GarminOAuth2Tokens, GarminOAuthConfig } from "./types";

// Garmin Connect OAuth2 PKCE (Garmin "OAuth2.0 PKCE Specification").
export const GARMIN_OAUTH2_AUTHORIZE_URL = "https://connect.garmin.com/oauth2Confirm";
export const GARMIN_OAUTH2_TOKEN_URL =
  "https://diauth.garmin.com/di-oauth2-service/oauth/token";

// Garmin recommends refreshing at least 600 seconds before expiry.
const REFRESH_MARGIN_MS = 10 * 60 * 1000;

/** A random 86-character verifier (spec: 43–128 chars) and its S256 challenge. */
export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(64).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function garminOAuth2AuthorizationUrl(
  config: GarminOAuthConfig,
  state: string,
  challenge: string,
): string {
  const url = new URL(GARMIN_OAUTH2_AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.consumerKey);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("state", state);
  return url.toString();
}

export const exchangeGarminOAuth2Code = (
  config: GarminOAuthConfig,
  code: string,
  verifier: string,
): Promise<GarminOAuth2Tokens> =>
  requestTokens(config, {
    grant_type: "authorization_code",
    code,
    code_verifier: verifier,
    redirect_uri: config.redirectUri,
  });

export const refreshGarminOAuth2Tokens = (
  config: GarminOAuthConfig,
  refreshToken: string,
): Promise<GarminOAuth2Tokens> =>
  requestTokens(config, {
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

export const needsRefresh = (expiresAt: Date | null, now = new Date()) =>
  !expiresAt || expiresAt.getTime() - REFRESH_MARGIN_MS <= now.getTime();

async function requestTokens(
  config: GarminOAuthConfig,
  form: Record<string, string>,
): Promise<GarminOAuth2Tokens> {
  const response = await fetch(GARMIN_OAUTH2_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      ...form,
      client_id: config.consumerKey,
      client_secret: config.consumerSecret,
    }),
  });
  const body = await response.text();
  if (!response.ok) throw new GarminApiError(response.status, "oauth2/token", body);
  const json = JSON.parse(body) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!json.access_token || !json.refresh_token || !json.expires_in)
    throw new GarminApiError(502, "oauth2/token", "Incomplete token response");
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: new Date(Date.now() + json.expires_in * 1000),
  };
}
