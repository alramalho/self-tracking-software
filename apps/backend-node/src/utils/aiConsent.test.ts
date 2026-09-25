import { afterEach, describe, expect, it } from "vitest";
import { assertAiConsent, hasAiConsent } from "./aiConsent";
import { requestContext } from "./requestContext";

const earlier = new Date("2026-09-01T10:00:00Z");
const later = new Date("2026-09-02T10:00:00Z");

afterEach(() => {
  delete process.env.AI_CONSENT_ENFORCED;
});

describe("hasAiConsent", () => {
  it("allows everyone while the flag is off, so older app builds keep working", () => {
    expect(hasAiConsent({ aiConsentGrantedAt: null, aiConsentDeclinedAt: null })).toBe(true);
    expect(hasAiConsent({ aiConsentGrantedAt: null, aiConsentDeclinedAt: later })).toBe(true);
    expect(hasAiConsent(undefined)).toBe(true);
  });

  it("with the flag on, allows only people whose latest choice was Allow", () => {
    process.env.AI_CONSENT_ENFORCED = "true";
    expect(hasAiConsent({ aiConsentGrantedAt: null, aiConsentDeclinedAt: null })).toBe(false);
    expect(hasAiConsent(undefined)).toBe(false);
    expect(hasAiConsent({ aiConsentGrantedAt: earlier, aiConsentDeclinedAt: null })).toBe(true);
    expect(hasAiConsent({ aiConsentGrantedAt: null, aiConsentDeclinedAt: earlier })).toBe(false);
    // Allowed, then turned off in Settings.
    expect(hasAiConsent({ aiConsentGrantedAt: earlier, aiConsentDeclinedAt: later })).toBe(false);
    // Said Not now, then allowed later.
    expect(hasAiConsent({ aiConsentGrantedAt: later, aiConsentDeclinedAt: earlier })).toBe(true);
  });

  it("stops AI calls made while serving someone who has not allowed AI", () => {
    process.env.AI_CONSENT_ENFORCED = "true";
    const asUser = (user: any) => requestContext.run({ user }, assertAiConsent);
    expect(() => asUser({ aiConsentGrantedAt: null, aiConsentDeclinedAt: null })).toThrow(
      "Turn on AI features in Settings to use this.",
    );
    expect(() => asUser({ aiConsentGrantedAt: earlier, aiConsentDeclinedAt: null })).not.toThrow();
    // Cron jobs run outside a request and filter people themselves.
    expect(() => assertAiConsent()).not.toThrow();
  });
});
