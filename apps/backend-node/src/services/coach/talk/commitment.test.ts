import { describe, expect, it } from "vitest";
import { checkInTimes, resolveCheckTime } from "./commitment";

const clock = { timezone: "Europe/Lisbon", morning: "09:00" };
const TODAY = "2026-11-08";
const at = (iso: string) => new Date(iso);

describe("when the coach checks on a commitment", () => {
  it("offers the next half hour at least 45 minutes away, and the evening by default", () => {
    expect(checkInTimes(at("2026-11-08T11:24:00Z"), clock)).toEqual({ earliestToday: "12:30", latest: "22:00", usual: "20:00" });
  });

  it("is too late today after about 21:15", () => {
    expect(checkInTimes(at("2026-11-08T21:40:00Z"), clock).earliestToday).toBeNull();
  });

  const times = checkInTimes(at("2026-11-08T11:24:00Z"), clock);
  it("a short run today with no time: checks that evening", () => {
    expect(resolveCheckTime(TODAY, TODAY, "", times)).toBe("20:00");
  });

  it("a morning session already past: the earliest time it can still check", () => {
    expect(resolveCheckTime(TODAY, TODAY, "12:00", times)).toBe("12:30");
  });

  it("never later than 22:00, and a later day keeps the time it picked", () => {
    expect(resolveCheckTime(TODAY, TODAY, "23:30", times)).toBe("22:00");
    expect(resolveCheckTime("2026-11-12", TODAY, "18:00", times)).toBe("18:00");
    expect(resolveCheckTime("2026-11-12", TODAY, "06:00", times)).toBe("08:00");
  });

  it("too late today: no check-in", () => {
    expect(resolveCheckTime(TODAY, TODAY, "21:30", checkInTimes(at("2026-11-08T21:40:00Z"), clock))).toBeNull();
  });
});
