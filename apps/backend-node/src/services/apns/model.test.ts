import { describe, expect, it } from "vitest";

import { isInvalidApnsDeviceToken } from "./model";

describe("isInvalidApnsDeviceToken", () => {
  it.each([
    ["BadDeviceToken", 400],
    ["DeviceTokenNotForTopic", 400],
    ["Unregistered", 410],
    ["other", 410],
  ])("recognizes %s (%s)", (reason, status) => {
    expect(isInvalidApnsDeviceToken(reason, status)).toBe(true);
  });

  it("does not clear a token for a retryable APNs failure", () => {
    expect(isInvalidApnsDeviceToken("TooManyRequests", 429)).toBe(false);
  });
});
