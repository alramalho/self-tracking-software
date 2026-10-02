import { describe, expect, it } from "vitest";
import {
  describeStreak,
  missedWeekReason,
  streakAfter,
  STREAK_RULES_FOR_COACH,
  weekOutcome,
} from "@tsw/prisma/follow-through/streak";

const week = (done: number, target: number) => ({ completed: done >= target, done, target });

describe("the streak rule", () => {
  it("a completed week adds one", () => {
    expect(weekOutcome(week(4, 4))).toBe("complete");
    expect(streakAfter(7, "complete")).toBe(8);
  });

  it("one short of a target of 3 or more holds the streak", () => {
    expect(weekOutcome(week(3, 4), "complete")).toBe("held");
    expect(weekOutcome(week(2, 3))).toBe("held");
    expect(streakAfter(8, "held")).toBe(8);
  });

  it("does not hold two weeks in a row", () => {
    expect(weekOutcome(week(3, 4), "held")).toBe("missed");
    // After a missed or complete week, one short holds again.
    expect(weekOutcome(week(3, 4), "missed")).toBe("held");
  });

  it("small targets and bigger gaps are missed, costing one week and never below zero", () => {
    expect(weekOutcome(week(1, 2))).toBe("missed");
    expect(weekOutcome(week(2, 4))).toBe("missed");
    expect(streakAfter(8, "missed")).toBe(7);
    expect(streakAfter(0, "missed")).toBe(0);
  });
});

describe("what the coach reads", () => {
  it("says why last week was missed", () => {
    const missed = { streakBefore: 8, streakAfter: 7, inARow: 1, done: 3, target: 4, oneShortAgain: true };
    expect(missedWeekReason(missed)).toContain("second week in a row");
    expect(missedWeekReason({ ...missed, done: 1, oneShortAgain: false })).toBe("1 of 4 sessions done");
    expect(describeStreak({ streak: 7, missedLastWeek: missed })).toContain("streak went 8 → 7");
    expect(describeStreak({ streak: 3, missedLastWeek: null })).toBe("3 weeks");
  });

  it("is told the hold and that a miss costs one week, not a reset", () => {
    const rules = STREAK_RULES_FOR_COACH.join(" ");
    expect(rules).toContain("holds");
    expect(rules).toContain("not two weeks in a row");
    expect(rules).toContain("subtracts -1");
    expect(rules).toContain("never resets");
  });
});
