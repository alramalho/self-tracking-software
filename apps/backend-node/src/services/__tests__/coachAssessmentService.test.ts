import { describe, expect, it } from "vitest";
import { isWithinPreferredCoachWindow } from "../coachAssessmentService";

describe("preferred coach window", () => {
  it("returns true within the 2-hour preferred interval", () => {
    expect(
      isWithinPreferredCoachWindow(
        { timezone: "Europe/Berlin", preferredCoachingHour: 6 },
        new Date("2026-05-19T04:30:00.000Z") // 6:30 Berlin
      )
    ).toBe(true);
  });

  it("returns false outside the preferred interval", () => {
    expect(
      isWithinPreferredCoachWindow(
        { timezone: "Europe/Berlin", preferredCoachingHour: 6 },
        new Date("2026-05-19T08:30:00.000Z") // 10:30 Berlin
      )
    ).toBe(false);
  });

  it("defaults to 6am when preferredCoachingHour is null", () => {
    expect(
      isWithinPreferredCoachWindow(
        { timezone: "UTC", preferredCoachingHour: null },
        new Date("2026-05-19T06:30:00.000Z")
      )
    ).toBe(true);

    expect(
      isWithinPreferredCoachWindow(
        { timezone: "UTC", preferredCoachingHour: null },
        new Date("2026-05-19T08:30:00.000Z")
      )
    ).toBe(false);
  });

  it("handles evening preferred hours", () => {
    expect(
      isWithinPreferredCoachWindow(
        { timezone: "America/New_York", preferredCoachingHour: 20 },
        new Date("2026-05-20T00:30:00.000Z") // 8:30pm ET
      )
    ).toBe(true);

    expect(
      isWithinPreferredCoachWindow(
        { timezone: "America/New_York", preferredCoachingHour: 20 },
        new Date("2026-05-20T02:30:00.000Z") // 10:30pm ET
      )
    ).toBe(false);
  });
});
