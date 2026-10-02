import assert from "node:assert/strict";
import test from "node:test";

import { newStreakMilestones } from "../src/analytics/streak-milestones";

test("a plan seen for the first time only records its baseline", () => {
  const { next, reached } = newStreakMilestones({}, [
    { planId: "run", streak: 10 },
  ]);
  assert.deepEqual(reached, []);
  assert.deepEqual(next, { run: 9 });
});

test("reports each milestone crossed since the last report", () => {
  const { next, reached } = newStreakMilestones({ run: 1 }, [
    { planId: "run", streak: 4 },
  ]);
  assert.deepEqual(reached, [
    { planId: "run", weeks: 2 },
    { planId: "run", weeks: 4 },
  ]);
  assert.deepEqual(next, { run: 4 });
});

test("the same streak is never reported twice", () => {
  const { reached } = newStreakMilestones({ run: 4 }, [
    { planId: "run", streak: 5 },
  ]);
  assert.deepEqual(reached, []);
});

test("a rebuilt streak counts again after it breaks", () => {
  const broken = newStreakMilestones({ run: 4 }, [{ planId: "run", streak: 0 }]);
  assert.deepEqual(broken.reached, []);
  const rebuilt = newStreakMilestones(broken.next, [
    { planId: "run", streak: 1 },
  ]);
  assert.deepEqual(rebuilt.reached, [{ planId: "run", weeks: 1 }]);
});

test("a new plan starting at zero reports its first week", () => {
  const seen = newStreakMilestones({}, [{ planId: "read", streak: 0 }]);
  const { reached } = newStreakMilestones(seen.next, [
    { planId: "read", streak: 1 },
  ]);
  assert.deepEqual(reached, [{ planId: "read", weeks: 1 }]);
});
