import { describe, expect, it } from "vitest";
import {
  ageLever,
  circleScore,
  goalLever,
  matchReasons,
  mutualScore,
  pairScore,
  paceLever,
  placeLever,
} from "./levers";
import type { MatchProfile } from "../types";

const lisbon = { latitude: 38.7, longitude: -9.1 };
const porto = { latitude: 41.2, longitude: -8.6 };

function person(overrides: Partial<MatchProfile> = {}): MatchProfile {
  return {
    userId: "u",
    planId: "p",
    timezone: "Europe/Lisbon",
    age: 27,
    latitude: null,
    longitude: null,
    weeklyTarget: 4,
    completionRate: 0.8,
    preferences: { wantsPace: true, wantsNearby: false, wantsAge: false },
    ...overrides,
  };
}

describe("circle matching levers", () => {
  it("keeps a middling goal match in the middle and rewards close goals", () => {
    expect(goalLever(0.5)).toBeCloseTo(0.5);
    expect(goalLever(0.8)).toBeGreaterThan(0.9);
    expect(goalLever(0.2)).toBeLessThan(0.1);
  });

  it("scores pace on both the weekly target and how often people show up", () => {
    const steady = person({ weeklyTarget: 4, completionRate: 0.9 });
    expect(paceLever(steady, person({ weeklyTarget: 4, completionRate: 0.9 }))).toBe(1);
    expect(paceLever(steady, person({ weeklyTarget: 2, completionRate: 0.9 }))).toBeCloseTo(0.7);
    expect(paceLever(steady, person({ weeklyTarget: 4, completionRate: 0.1 }))).toBeCloseTo(0.68);
    // New people have no history yet, so only the target counts.
    expect(paceLever(steady, person({ completionRate: null }))).toBe(1);
  });

  it("uses real distance only for people who asked for nearby", () => {
    const near = person({ ...lisbon, preferences: { wantsPace: true, wantsNearby: true, wantsAge: false } });
    expect(placeLever(near, person(lisbon))).toEqual({ value: 1, sameCity: true });
    expect(placeLever(near, person(porto)).value).toBeLessThan(0.4);
    const wide = person(lisbon);
    expect(placeLever(wide, person({ ...porto, timezone: "Europe/Lisbon" }))).toEqual({ value: 1, sameCity: false });
    expect(placeLever(wide, person({ timezone: "America/New_York" })).value).toBe(0.3);
  });

  it("treats a missing age as neutral rather than a mismatch", () => {
    expect(ageLever(27, 27)).toBe(1);
    expect(ageLever(27, null)).toBe(0.5);
    expect(ageLever(20, 60)).toBeLessThan(0.1);
  });

  it("drops levers a person didn't pick and rescales the rest", () => {
    const noAge = pairScore(person(), person({ age: 70 }), 0.8);
    expect(noAge.levers.age).toBeUndefined();
    const withAge = pairScore(
      person({ preferences: { wantsPace: true, wantsNearby: false, wantsAge: true } }),
      person({ age: 70 }),
      0.8,
    );
    expect(withAge.score).toBeLessThan(noAge.score);
  });

  it("makes a pair only as good as the side that asked for more", () => {
    const wantsNearby = person({
      ...lisbon,
      preferences: { wantsPace: true, wantsNearby: true, wantsAge: false },
    });
    const faraway = person({ latitude: 52.5, longitude: 13.4, timezone: "Europe/Berlin" });
    expect(mutualScore(wantsNearby, faraway, 0.8)).toBe(
      pairScore(wantsNearby, faraway, 0.8).score,
    );
    expect(mutualScore(wantsNearby, faraway, 0.8)).toBeLessThan(
      pairScore(faraway, wantsNearby, 0.8).score,
    );
  });

  it("averages a newcomer's fit across the circle and only claims reasons true for all", () => {
    const newcomer = person({ userId: "n", planId: "n" });
    const members = [
      person({ userId: "a", planId: "a" }),
      person({ userId: "b", planId: "b", age: 60, timezone: "Asia/Tokyo" }),
    ];
    const goals = new Map([
      ["a", 0.8],
      ["b", 0.8],
    ]);
    const score = circleScore(newcomer, members, goals);
    expect(score).toBeGreaterThan(0.5);
    const reasons = matchReasons(newcomer, members, goals);
    expect(reasons).toContain("goal");
    expect(reasons).toContain("pace");
    expect(reasons).not.toContain("timezone");
    expect(reasons).not.toContain("age");
  });
});
