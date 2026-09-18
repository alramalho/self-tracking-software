import { describe, expect, it } from "vitest";

import {
  createOAuth1AuthorizationHeader,
  decryptGarminSecret,
  encryptGarminSecret,
} from "./oauth";

describe("Garmin OAuth helpers", () => {
  it("encrypts and decrypts provider secrets", () => {
    const encrypted = encryptGarminSecret(
      "a-token-secret",
      "local-test-encryption-key",
    );

    expect(decryptGarminSecret(encrypted, "local-test-encryption-key")).toBe(
      "a-token-secret",
    );
    expect(encrypted).not.toContain("a-token-secret");
  });

  it("creates an OAuth 1 authorization header without exposing the consumer secret", () => {
    const header = createOAuth1AuthorizationHeader(
      "GET",
      "https://example.com/wellness-api/rest/user/id?b=2&a=1",
      { consumerKey: "consumer-key", consumerSecret: "consumer-secret" },
      { oauth_token: "access-token" },
      "access-token-secret",
    );

    expect(header).toMatch(/^OAuth /);
    expect(header).toContain('oauth_consumer_key="consumer-key"');
    expect(header).toContain("oauth_signature=");
    expect(header).not.toContain("consumer-secret");
    expect(header).not.toContain("access-token-secret");
  });
});
