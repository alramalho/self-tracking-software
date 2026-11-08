import { describe, expect, it } from "vitest";
import { checkInAt, checkInTimes } from "./commitment";

const clock = { timezone: "Europe/Lisbon", morning: "09:00" };
const at = (iso: string) => new Date(iso);

describe("checking on a commitment", () => {
  it("today: three hours later, on the next half hour", () => {
    expect(checkInAt("2026-11-08", at("2026-11-08T11:24:00Z"), clock)?.toISOString()).toBe("2026-11-08T14:30:00.000Z");
  });

  it("today: never after 21:00", () => {
    expect(checkInAt("2026-11-08", at("2026-11-08T19:30:00Z"), clock)?.toISOString()).toBe("2026-11-08T21:00:00.000Z");
  });

  it("today: too late to check", () => {
    expect(checkInAt("2026-11-08", at("2026-11-08T20:40:00Z"), clock)).toBeNull();
    expect(checkInTimes(at("2026-11-08T20:40:00Z"), clock).today).toBeNull();
  });

  it("a later day: that morning at the plan's reminder time", () => {
    expect(checkInAt("2026-11-10", at("2026-11-08T11:24:00Z"), clock)?.toISOString()).toBe("2026-11-10T09:00:00.000Z");
  });

  it("tells the coach the times it may promise", () => {
    expect(checkInTimes(at("2026-11-08T11:24:00Z"), clock)).toEqual({ today: "14:30", laterDays: "09:00" });
  });
});
