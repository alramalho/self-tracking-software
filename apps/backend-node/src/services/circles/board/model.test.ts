import { describe, expect, it } from "vitest";
import { lastWeekRecap, memberWeek, pastWeeks, togetherStreak, type MemberHistory } from "./model";

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

  it("recaps last week with who hit their target and who showed up most", () => {
    const members: MemberHistory[] = [
      { name: "Rita", joinedAt: new Date("2026-08-01"), weeks: [week("2026-09-20", "complete", 4)] },
      { name: "Jonas", joinedAt: new Date("2026-08-01"), weeks: [week("2026-09-20", "missed", 1)] },
      { name: "Tomás", joinedAt: new Date("2026-08-01"), weeks: [week("2026-09-20", "complete", 6)] },
    ];
    expect(lastWeekRecap(members)).toMatchObject({ hit: 2, total: 3, topName: "Tomás", topCount: 6 });
  });

  it("ranks the past weeks by each person's share of their own target, extras not counted", () => {
    const counted = (date: string, outcome: "complete" | "held" | "missed", doneCount: number, targetCount: number) => ({
      ...week(date, outcome, doneCount),
      targetCount,
    });
    const members: MemberHistory[] = [
      // Twice a week, never missed: beats five sessions a week with one bad week.
      { id: "rita", name: "Rita", joinedAt: new Date("2026-08-01"), weeks: [counted("2026-09-13", "complete", 2, 2), counted("2026-09-20", "complete", 3, 2)] },
      { id: "tomas", name: "Tomás", joinedAt: new Date("2026-08-01"), weeks: [counted("2026-09-13", "complete", 5, 5), counted("2026-09-20", "missed", 2, 5)] },
      // Joined after 13 Sep: ranked on the one full week since.
      { id: "mia", name: "Mia", joinedAt: new Date("2026-09-15"), weeks: [counted("2026-09-13", "missed", 0, 3), counted("2026-09-20", "complete", 3, 3)] },
    ];
    const race = pastWeeks(members)!;
    expect(race.weeks.map((w) => [w.start, w.allHit, w.people.length])).toEqual([
      ["2026-09-13", true, 2],
      ["2026-09-20", false, 3],
    ]);
    expect(race.ranking).toEqual([
      { userId: "rita", percent: 100, rank: 1, hits: [true, true] },
      { userId: "mia", percent: 100, rank: 1, hits: [null, true] },
      { userId: "tomas", percent: 70, rank: 3, hits: [true, false] },
    ]);
  });

  it("has no past weeks to show until two people have finished a week together", () => {
    expect(pastWeeks([{ id: "a", name: "A", joinedAt: new Date("2026-08-01"), weeks: [week("2026-09-20", "complete")] }])).toBeNull();
  });
});
