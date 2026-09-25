import { describe, expect, it } from "vitest";
import { userSelfUpdate } from "./userSelfUpdate";

describe("userSelfUpdate", () => {
  it("keeps ordinary profile and settings changes", () => {
    const body = {
      name: "Alex",
      timezone: "Europe/Lisbon",
      iosDeviceToken: null,
      reactionEmojis: ["🔥", "👏"],
      onboardingProgress: { step: 2 },
    };
    expect(userSelfUpdate(body)).toEqual(body);
  });

  it("drops billing, identity and relation writes", () => {
    expect(
      userSelfUpdate({
        name: "Alex",
        planType: "PLUS",
        email: "someone@else.test",
        stripeSubscriptionId: "sub_x",
        deletedAt: null,
        plans: { create: { goal: "x" } },
        connections: [{ id: "other" }],
      }),
    ).toEqual({ name: "Alex" });
  });

  it("ignores a body that is not an object", () => {
    expect(userSelfUpdate(null)).toEqual({});
    expect(userSelfUpdate(["name"])).toEqual({});
  });
});
