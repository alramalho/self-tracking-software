import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { createPkcePair, garminOAuth2AuthorizationUrl, needsRefresh } from "./oauth2";
import type { GarminOAuthConfig } from "./types";

const config: GarminOAuthConfig = {
  oauthVersion: 2,
  consumerKey: "client-id",
  consumerSecret: "client-secret",
  redirectUri: "https://api.tracking.so/health/garmin/callback",
  tokenEncryptionKey: "test",
  frontendUrl: "https://app.tracking.so",
  apiBaseUrl: "https://apis.garmin.com/wellness-api/rest",
};

describe("Garmin OAuth2 PKCE", () => {
  it("creates a verifier Garmin accepts and its S256 challenge", () => {
    const { verifier, challenge } = createPkcePair();
    expect(verifier).toMatch(/^[A-Za-z0-9\-._~]{43,128}$/);
    expect(challenge).toBe(createHash("sha256").update(verifier).digest("base64url"));
  });

  it("sends the person to Garmin's consent page with the PKCE challenge and state", () => {
    const url = new URL(garminOAuth2AuthorizationUrl(config, "state-1", "challenge-1"));
    expect(url.origin + url.pathname).toBe("https://connect.garmin.com/oauth2Confirm");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: "code",
      client_id: "client-id",
      code_challenge: "challenge-1",
      code_challenge_method: "S256",
      redirect_uri: config.redirectUri,
      state: "state-1",
    });
  });

  it("refreshes a token ten minutes before it expires", () => {
    const now = new Date("2026-09-24T12:00:00Z");
    expect(needsRefresh(new Date("2026-09-24T12:30:00Z"), now)).toBe(false);
    expect(needsRefresh(new Date("2026-09-24T12:05:00Z"), now)).toBe(true);
    expect(needsRefresh(null, now)).toBe(true);
  });
});
