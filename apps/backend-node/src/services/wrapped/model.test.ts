import { describe, it, expect } from "vitest";
import { inYear, yearBounds, yearPlanStats } from "./model";
describe("annual Wrapped values", () => {
  it("uses inclusive January 1 and exclusive next January 1, independent of host timezone", () => {
    expect(inYear("2025-01-01T00:00:00.000Z",2025)).toBe(true);
    expect(inYear("2025-12-31T23:59:59.999Z",2025)).toBe(true);
    expect(inYear("2026-01-01T00:00:00Z",2025)).toBe(false);
    expect(inYear("2024-12-31T23:59:59.999Z",2025)).toBe(false);
    expect(inYear("invalid",2025)).toBe(false);
    expect(() => yearBounds(2025.5)).toThrow();
    expect(() => yearBounds(9999)).toThrow();
  });
  it("counts dated awards even if a badge was subsequently lost, never current/future status", () => {
    expect(yearPlanStats("p", {habitAchievement:{isAchieved:false,achievedAt:"2025-12-03T08:06:07Z"},lifestyleAchievement:{isAchieved:true,achievedAt:"2026-01-01"}},2025)).toEqual({id:"p",habitEarned:true,lifestyleEarned:false,peakStreak:0});
    expect(yearPlanStats("p", {habitAchievement:{isAchieved:true},lifestyleAchievement:{achievedAt:"2024-12-31"}},2025).habitEarned).toBe(false);
  });
  it("does not let future weeks or current streak totals inflate the 2025 peak", () => {
    const stats=yearPlanStats("p",{achievement:{streak:90},weeks:[
      {startDate:"2025-01-05",isCompleted:true},
      {startDate:"2025-01-12",isCompleted:false},
      {startDate:"2025-01-19",isCompleted:true},
      {startDate:"2026-01-04",isCompleted:true},
    ]},2025);
    expect(stats.peakStreak).toBe(2);
  });
  it("cannot borrow 2026 activity to complete the final partial week", () => {
    const progress={weeks:[{startDate:"2025-12-28",isCompleted:true,plannedActivities:2,completedActivities:[{datetime:"2025-12-29"},{datetime:"2026-01-01"}]}]};
    expect(yearPlanStats("p",progress,2025).peakStreak).toBe(0);
    progress.weeks[0].completedActivities[1].datetime="2025-12-30";
    expect(yearPlanStats("p",progress,2025).peakStreak).toBe(1);
  });
});
