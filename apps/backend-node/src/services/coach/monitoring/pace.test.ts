import { describe, expect, it } from "vitest";
import { planPace, weekAtRisk } from "@tsw/prisma/follow-through/pace";

const now = new Date("2026-09-30T18:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);
const started = daysAgo(60);

describe("plan pace (homepage ring and coach nudge share this rule)", () => {
  it("is on track when the weekly target was logged in the last 7 days", () => {
    expect(planPace({ timesPerWeek: 3, startedAt: started, now, logDates: [daysAgo(1), daysAgo(3), daysAgo(5)] })).toBe("on_track");
  });

  it("is normal while a gap is still within the plan's rhythm", () => {
    // 3x/week allows ceil(7/3) + 1 = 4 days between logs.
    expect(planPace({ timesPerWeek: 3, startedAt: started, now, logDates: [daysAgo(4)] })).toBe("normal");
  });

  it("is slipping once the gap is longer than the rhythm allows", () => {
    expect(planPace({ timesPerWeek: 3, startedAt: started, now, logDates: [daysAgo(5)] })).toBe("slipping");
    expect(planPace({ timesPerWeek: 1, startedAt: started, now, logDates: [daysAgo(9)] })).toBe("slipping");
    expect(planPace({ timesPerWeek: 1, startedAt: started, now, logDates: [daysAgo(7)] })).toBe("normal");
  });

  it("counts a new plan from the day it was created, not from nothing", () => {
    expect(planPace({ timesPerWeek: 3, startedAt: daysAgo(2), now, logDates: [] })).toBe("normal");
    expect(planPace({ timesPerWeek: 3, startedAt: daysAgo(6), now, logDates: [] })).toBe("slipping");
  });
});

describe("week at risk (the dashed amber dots)", () => {
  it("flags 4x/week with nothing done by Wednesday (5 days left, 4 needed)", () => {
    expect(weekAtRisk({ target: 4, doneDays: 0, daysLeft: 5 })).toBe(true);
    expect(weekAtRisk({ target: 4, doneDays: 0, daysLeft: 6 })).toBe(false);
  });

  it("stops once the week is out of reach or done", () => {
    expect(weekAtRisk({ target: 4, doneDays: 0, daysLeft: 3 })).toBe(false);
    expect(weekAtRisk({ target: 4, doneDays: 4, daysLeft: 2 })).toBe(false);
  });

  it("does not mark a daily plan at risk while it is on schedule", () => {
    expect(weekAtRisk({ target: 7, doneDays: 3, daysLeft: 4 })).toBe(false);
    expect(weekAtRisk({ target: 6, doneDays: 2, daysLeft: 4 })).toBe(true);
    expect(weekAtRisk({ target: 6, doneDays: 3, daysLeft: 4 })).toBe(false);
  });

  it("gives a once-a-week plan until the last two days", () => {
    expect(weekAtRisk({ target: 1, doneDays: 0, daysLeft: 3 })).toBe(false);
    expect(weekAtRisk({ target: 1, doneDays: 0, daysLeft: 2 })).toBe(true);
  });
});
