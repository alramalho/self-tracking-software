import { describe, expect, it } from "vitest";
import { isActivityPhotoNotificationEligible } from "./eligibility";

const eligible = (
  overrides: Partial<
    Parameters<typeof isActivityPhotoNotificationEligible>[0]
  > = {},
) =>
  isActivityPhotoNotificationEligible({
    completedAt: new Date("2026-09-23T09:00:00Z"),
    timezone: "Europe/Lisbon",
    now: new Date("2026-09-23T20:59:59.999Z"),
    ...overrides,
  });

describe("activity photo notification eligibility", () => {
  it("includes the exact 12-hour cutoff, but rejects the next millisecond", () => {
    expect(eligible({ now: new Date("2026-09-23T21:00:00Z") })).toBe(true);
    expect(eligible({ now: new Date("2026-09-23T21:00:00.001Z") })).toBe(false);
  });

  it("requires the completion date to be today in its own timezone", () => {
    expect(
      eligible({
        completedAt: new Date("2026-09-22T23:30:00Z"),
        now: new Date("2026-09-23T02:00:00Z"),
        timezone: "Europe/Lisbon",
      }),
    ).toBe(true);
    expect(
      eligible({
        completedAt: new Date("2026-09-22T23:30:00Z"),
        now: new Date("2026-09-23T02:00:00Z"),
        timezone: "UTC",
      }),
    ).toBe(false);
  });

  it("checks the local day even when the 12-hour window crosses midnight", () => {
    expect(
      eligible({
        completedAt: new Date("2026-09-23T21:30:00Z"),
        now: new Date("2026-09-24T00:01:00Z"),
        timezone: "Europe/Lisbon",
      }),
    ).toBe(false);
  });

  it("rejects a future completion time", () => {
    expect(eligible({ completedAt: new Date("2026-09-23T21:00:00Z") })).toBe(
      false,
    );
  });

  it("uses completion rather than the later logging time", () => {
    const now = new Date("2026-09-23T20:00:00Z");
    expect(
      eligible({ now, completedAt: new Date("2026-09-23T05:00:00Z") }),
    ).toBe(false);
    expect(
      eligible({ now, completedAt: new Date("2026-09-23T19:00:00Z") }),
    ).toBe(true);
  });
});
