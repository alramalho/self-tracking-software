import { test } from "node:test";
import assert from "node:assert/strict";
import type { Plan } from "../src/core/types";
import {
  exampleTarget,
  recentStreakWeeks,
  streakExamples,
} from "../src/features/plans/streak-explainer";

const plan = (weeks: unknown[], timesPerWeek: number | null = 4) =>
  ({ timesPerWeek, progress: { weeks } }) as unknown as Plan;

test("the examples show a full week, one short and a miss for the plan's target", () => {
  const rows = streakExamples(4);
  assert.deepEqual(
    rows.map((row) => [row.outcome, row.done, row.target, row.change]),
    [
      ["complete", 4, 4, "+1"],
      ["held", 3, 4, "Holds"],
      ["missed", 2, 4, "−1"],
    ],
  );
});

test("a target under 3 has no one-short week, because nothing holds there", () => {
  assert.deepEqual(
    streakExamples(2).map((row) => [row.outcome, row.done]),
    [
      ["complete", 2],
      ["missed", 0],
    ],
  );
});

test("the example target is the plan's own, or the last scored week's, or 4", () => {
  assert.equal(exampleTarget(plan([], 5)), 5);
  assert.equal(exampleTarget(plan([{ startDate: "2026-09-20", outcome: "missed", targetCount: 3 }], null)), 3);
  assert.equal(exampleTarget(plan([], null)), 4);
  assert.equal(exampleTarget(plan([], 12)), 7);
});

test("your last weeks are the latest finished ones, oldest first, with the server's count", () => {
  const weeks = recentStreakWeeks(
    plan([
      { startDate: "2026-09-27T00:00:00.000Z", isCompleted: false, doneCount: 1, targetCount: 4 },
      { startDate: "2026-09-20T00:00:00.000Z", outcome: "missed", doneCount: 3, targetCount: 4 },
      { startDate: "2026-09-06T00:00:00.000Z", outcome: "complete", doneCount: 4, targetCount: 4 },
      { startDate: "2026-09-13T00:00:00.000Z", outcome: "held", doneCount: 3, targetCount: 4 },
    ]),
  );
  assert.deepEqual(
    weeks.map((week) => [week.label, `${week.done}/${week.target}`, week.outcome]),
    [
      ["Sep 6", "4/4", "complete"],
      ["Sep 13", "3/4", "held"],
      ["Sep 20", "3/4", "missed"],
    ],
  );
});

test("older servers without counts fall back to the week's logs and planned number", () => {
  const [week] = recentStreakWeeks(
    plan([
      {
        startDate: "2026-09-13T00:00:00.000Z",
        outcome: "held",
        plannedActivities: 3,
        completedActivities: [
          { datetime: "2026-09-14T10:00:00.000Z" },
          { datetime: "2026-09-14T18:00:00.000Z" },
          { datetime: "2026-09-16T10:00:00.000Z" },
        ],
      },
    ]),
  );
  assert.equal(`${week.done}/${week.target}`, "2/3");
});
