import { test } from "node:test";
import assert from "node:assert/strict";
import { streakProgress, progressCircles } from "../src/features/plans/streak-progress";

test("lifestyle stays selected when the backend retires the habit flag", () => {
  assert.deepEqual(streakProgress({ achievement: { streak: 20 }, habitAchievement: { isAchieved: false, progressValue: 4, maxValue: 4 }, lifestyleAchievement: { isAchieved: true, progressValue: 9, maxValue: 9 } }), { stage: "Lifestyle", streak: 20, target: 9 });
  assert.deepEqual(progressCircles(20, 9), { count: 9, filled: 9, overflow: 11 });
});
test("stage changes at four and preserves the ninth circle at nine", () => {
  assert.equal(streakProgress({ achievement: { streak: 3 } }).stage, "Habit");
  assert.equal(streakProgress({ achievement: { streak: 4 } }).stage, "Lifestyle");
  assert.deepEqual(progressCircles(9, 9), { count: 9, filled: 9, overflow: 0 });
});
test("an authoritative broken streak beats stale achievement flags", () => {
  assert.equal(streakProgress({ achievement: { streak: 0 }, lifestyleAchievement: { isAchieved: true, progressValue: 9 } }).stage, "Habit");
});
test("legacy cached achievements still select the right stage", () => {
  assert.equal(streakProgress({ habitAchievement: { isAchieved: false, progressValue: 4 }, lifestyleAchievement: { isAchieved: true, progressValue: 9 } }).stage, "Lifestyle");
  assert.deepEqual(progressCircles(0, 4), { count: 4, filled: 0, overflow: 0 });
});
