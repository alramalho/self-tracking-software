import { test } from "node:test";
import assert from "node:assert/strict";
import { amountLine, celebrationFor } from "../src/features/celebration/model";

const now = new Date("2026-11-13T19:00:00"); // a Friday, local time
const run = { id: "run", title: "running", emoji: "🏃", measure: "kilometers" };
const plan = (over: object = {}) =>
  ({ id: "p", goal: "train 4 times a week", emoji: "💪", outlineType: "TIMES_PER_WEEK", timesPerWeek: 4, activities: [run], progress: { achievement: { streak: 3 } }, ...over }) as never;
const entry = (iso: string) => ({ id: iso, activityId: "run", datetime: iso, quantity: 5 }) as never;

test("the line names the activity and the amount", () => {
  assert.equal(amountLine(run, 5), "Running · 5 km");
  assert.equal(amountLine({ title: "Reading", measure: "pages" }, 21), "Reading · 21 pages");
});

test("a log on a new day moves the stepper up by one", () => {
  const c = celebrationFor({ activity: run, quantity: 5, datetime: now, plans: [plan()], entries: [entry("2026-11-09T08:00:00"), entry("2026-11-11T08:00:00")], now });
  assert.deepEqual([c.plan?.before, c.plan?.after, c.weekDone], [2, 3, false]);
});

test("the log that fills the target completes the week and adds a streak week", () => {
  const c = celebrationFor({ activity: run, quantity: 5, datetime: now, plans: [plan()], entries: ["09", "10", "11"].map((d) => entry(`2026-11-${d}T08:00:00`)), now });
  assert.deepEqual([c.plan?.before, c.plan?.after, c.weekDone, c.plan?.streakBefore, c.plan?.streakAfter], [3, 4, true, 3, 4]);
});

test("a second log the same day doesn't move the stepper", () => {
  const c = celebrationFor({ activity: run, quantity: 1, datetime: now, plans: [plan()], entries: [entry("2026-11-13T07:00:00")], now });
  assert.deepEqual([c.plan?.before, c.plan?.after, c.weekDone], [1, 1, false]);
});

test("no plan, or a log from last week: just the activity", () => {
  assert.equal(celebrationFor({ activity: run, quantity: 5, datetime: now, plans: [], entries: [], now }).plan, null);
  assert.equal(celebrationFor({ activity: run, quantity: 5, datetime: new Date("2026-11-06T08:00:00"), plans: [plan()], entries: [], now }).plan, null);
});
