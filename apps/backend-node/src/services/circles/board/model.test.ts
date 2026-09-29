import { describe, expect, it } from "vitest";
import { lastWeekRecap, memberWeek, recapMessage, togetherStreak, type MemberHistory } from "./model";

const monday = new Date("2026-09-27T00:00:00Z");
const stats = (target: number, done: number, left: number) => ({
  numActiveDaysInTheWeek: target,
  daysCompletedThisWeek: done,
  numLeftDaysInTheWeek: left,
});

describe("circle board", () => {
  it("flags someone as behind only when finishing needs every remaining day", () => {
    expect(memberWeek(stats(4, 1, 2), new Date("2026-09-01"), monday)).toMatchObject({ toGo: 3, behind: true });
    expect(memberWeek(stats(4, 2, 2), new Date("2026-09-01"), monday)).toMatchObject({ toGo: 2, behind: true });
    expect(memberWeek(stats(4, 3, 3), new Date("2026-09-01"), monday)).toMatchObject({ toGo: 1, behind: false });
    expect(memberWeek(stats(3, 3, 1), new Date("2026-09-01"), monday)).toMatchObject({ toGo: 0, behind: false });
  });

  it("never counts a mid-week joiner as behind", () => {
    const week = memberWeek(stats(4, 0, 1), new Date("2026-09-30"), monday);
    expect(week).toMatchObject({ isNew: true, behind: false, toGo: 4 });
  });

  const week = (date: string, outcome: "complete" | "held" | "missed", doneCount = 3) => ({
    startDate: `${date}T00:00:00.000Z`,
    outcome,
    doneCount,
  });

  it("counts weeks in a row where everyone already in the circle hit their target", () => {
    const members: MemberHistory[] = [
      { name: "Rita", joinedAt: new Date("2026-08-01"), weeks: [week("2026-09-06", "missed"), week("2026-09-13", "complete"), week("2026-09-20", "held")] },
      { name: "Tomás", joinedAt: new Date("2026-08-01"), weeks: [week("2026-09-06", "complete"), week("2026-09-13", "complete"), week("2026-09-20", "complete")] },
      // Joined after 13 Sep: only counts from the week of 20 Sep.
      { name: "Mia", joinedAt: new Date("2026-09-15"), weeks: [week("2026-09-13", "missed", 0), week("2026-09-20", "complete")] },
    ];
    expect(togetherStreak(members)).toBe(2);
  });

  it("needs at least two people for a together week", () => {
    expect(togetherStreak([{ name: "A", joinedAt: new Date("2026-08-01"), weeks: [week("2026-09-20", "complete")] }])).toBe(0);
  });

  it("recaps last week without naming who fell short", () => {
    const members: MemberHistory[] = [
      { name: "Rita", joinedAt: new Date("2026-08-01"), weeks: [week("2026-09-20", "complete", 4)] },
      { name: "Jonas", joinedAt: new Date("2026-08-01"), weeks: [week("2026-09-20", "missed", 1)] },
      { name: "Tomás", joinedAt: new Date("2026-08-01"), weeks: [week("2026-09-20", "complete", 6)] },
    ];
    const recap = lastWeekRecap(members)!;
    expect(recap).toMatchObject({ hit: 2, total: 3, topName: "Tomás", topCount: 6 });
    const message = recapMessage(recap, 0);
    expect(message).toBe("2 of 3 of you hit your week. Tomás showed up most, 6 times. A fresh week starts now.");
    expect(message).not.toContain("Jonas");
    expect(recapMessage({ ...recap, hit: 3 }, 3)).toContain("That's 3 weeks together.");
  });
});
