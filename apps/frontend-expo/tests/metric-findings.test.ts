import assert from "node:assert/strict";
import test from "node:test";
import {
  activityFindings,
  signalStrength,
} from "../src/features/metrics/model";
import {
  activityDetail,
  countUp,
  headline,
  moreWaiting,
  percent,
  signalLine,
  trendLine,
  waitingForActivity,
  weekdayLine,
} from "../src/features/metrics/words";
import type { Activity, ActivityEntry, MetricEntry } from "../src/core/types";
import type { SleepFinding } from "../src/features/metrics/model";

const activity = (id: string, title: string) =>
  ({ id, title, emoji: "🏋️", measure: "sessions", userId: "user" }) as Activity;
const gym = activity("gym", "Gym");
const chess = activity("chess", "Chess");

// Day 1 is 1 September 2026. A check-in is saved as a date at UTC midnight.
const checkIn = (day: number, rating: number, extra = {}) =>
  ({
    id: `m${day}-${rating}`,
    metricId: "energy",
    rating,
    createdAt: new Date(Date.UTC(2026, 8, day)).toISOString(),
    ...extra,
  }) as MetricEntry;
// Logged at local noon, so the day is the same in every timezone.
const logged = (activityId: string, day: number, extra = {}) =>
  ({
    id: `${activityId}-${day}`,
    activityId,
    userId: "user",
    quantity: 1,
    datetime: new Date(2026, 8, day, 12).toISOString(),
    createdAt: new Date(2026, 8, day, 12).toISOString(),
    ...extra,
  }) as ActivityEntry;
const days = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

test("an activity counts for the check-in given on the same day", () => {
  // Gym on days 1-5 (rated 2), nothing on days 6-10 (rated 4).
  const metrics = [
    ...days(1, 5).map((day) => checkIn(day, 2)),
    ...days(6, 10).map((day) => checkIn(day, 4)),
  ];
  const entries = days(1, 5).map((day) => logged("gym", day));
  const [row] = activityFindings(metrics, [gym], entries);
  assert.equal(row.days, 5);
  assert.equal(row.otherDays, 5);
  assert.equal(row.average, 2);
  assert.equal(row.otherAverage, 4);
  // Half the energy of other days, not the previous day's activity.
  assert.equal(row.difference, -0.5);
});

test("several check-ins on one day count as one day at their average", () => {
  const metrics = [
    checkIn(1, 1),
    checkIn(1, 5),
    ...days(2, 5).map((day) => checkIn(day, 3)),
    ...days(6, 10).map((day) => checkIn(day, 4)),
  ];
  const [row] = activityFindings(
    metrics,
    [gym],
    days(1, 5).map((day) => logged("gym", day)),
  );
  assert.equal(row.days, 5);
  assert.equal(row.average, 3);
});

test("fewer than five days of either kind gives a row without a number", () => {
  const metrics = days(1, 10).map((day) => checkIn(day, 3));
  const few = activityFindings(
    metrics,
    [gym],
    days(1, 2).map((day) => logged("gym", day)),
  )[0];
  assert.equal(few.difference, null);
  assert.equal(waitingForActivity(few), "3 more days");
  // Done nearly every day: there are too few other days to compare with.
  const daily = activityFindings(
    metrics,
    [gym],
    days(1, 9).map((day) => logged("gym", day)),
  )[0];
  assert.equal(daily.difference, null);
  assert.equal(waitingForActivity(daily), "4 more days without");
});

test("skipped, out-of-range and deleted entries are left out", () => {
  const metrics = [
    ...days(1, 5).map((day) => checkIn(day, 2)),
    ...days(6, 10).map((day) => checkIn(day, 4)),
    checkIn(11, 0, { skipped: true }),
    checkIn(12, 9),
  ];
  const entries = [
    ...days(1, 5).map((day) => logged("gym", day)),
    logged("gym", 6, { deletedAt: "2026-09-07T00:00:00Z" }),
    logged("gym", 11),
    logged("gym", 12),
  ];
  const [row] = activityFindings(metrics, [gym], entries);
  assert.equal(row.days, 5);
  assert.equal(row.otherDays, 5);
});

test("under seven check-ins, and activities never logged, give no rows", () => {
  const six = days(1, 6).map((day) => checkIn(day, 3));
  assert.deepEqual(activityFindings(six, [gym], [logged("gym", 1)]), []);
  const ten = days(1, 10).map((day) => checkIn(day, 3));
  assert.deepEqual(activityFindings(ten, [gym], []), []);
});

test("rows with a number come first, largest difference first", () => {
  const metrics = [
    ...days(1, 5).map((day) => checkIn(day, 2)),
    ...days(6, 10).map((day) => checkIn(day, 4)),
    ...days(11, 15).map((day) => checkIn(day, 5)),
  ];
  const sauna = activity("sauna", "Sauna");
  const rows = activityFindings(metrics, [sauna, chess, gym], [
    ...days(1, 5).map((day) => logged("gym", day)),
    ...days(11, 15).map((day) => logged("chess", day)),
    logged("sauna", 6),
  ]);
  assert.deepEqual(
    rows.map((row) => row.activity.title),
    ["Chess", "Gym", "Sauna"],
  );
});

test("signal strength steps at 5, 15 and 30 days", () => {
  assert.deepEqual(
    [4, 5, 14, 15, 29, 30].map((count) => signalStrength(count)),
    [0, 1, 1, 2, 2, 3],
  );
  // Sleep shows its first bar from three paired nights.
  assert.equal(signalStrength(3, 3), 1);
  assert.equal(signalLine(8, "day"), "Signal 1 of 3. 7 more days for the next bar.");
  assert.equal(signalLine(29, "night", 3), "Signal 2 of 3. 1 more night for the next bar.");
  assert.equal(signalLine(40, "day"), "Signal 3 of 3.");
});

const finding = (
  item: Activity,
  difference: number | null,
  count = 20,
  other = 20,
) => ({
  activity: item,
  average: 3,
  otherAverage: 3.5,
  difference,
  days: count,
  otherDays: other,
});
const sleep = (difference: number | null, sampleSize = 10) =>
  ({ difference, sampleSize, comparable: sampleSize >= 3 }) as SleepFinding;

test("the headline names the largest lift and the largest drain", () => {
  assert.equal(
    headline("Energy", [finding(gym, -0.21), finding(chess, 0.18)]),
    "Your energy tends to be higher on Chess days and lower on Gym days.",
  );
  assert.equal(
    headline("Energy", [finding(gym, -0.21)]),
    "Your energy tends to be lower on Gym days.",
  );
  assert.equal(
    headline("Happiness", [finding(chess, 0.18)], sleep(0.3)),
    "Your happiness tends to be higher after a good night's sleep.",
  );
});

test("the headline never states a finding the days cannot support", () => {
  // Under 5%, or no number yet, is not a finding.
  assert.equal(
    headline("Energy", [finding(gym, -0.04), finding(chess, null, 2)]),
    "Nothing stands out yet. Your energy looks much the same whatever you do that day.",
  );
  assert.equal(
    headline("Energy", [finding(chess, null, 2), finding(gym, null, 1)]),
    "Too early to say. Check in on 3 more Chess days and I'll have something for you.",
  );
  assert.equal(
    headline("Energy", [finding(gym, null, 9, 4)]),
    "Too early to say. Check in on 1 more day without Gym and I'll have something for you.",
  );
  assert.equal(
    headline("Energy", [], sleep(null, 1)),
    "Too early to say. Check in after 2 more nights and I'll know how sleep fits in.",
  );
  assert.equal(
    headline("Energy", []),
    "Log what you do on the days you check in and I'll tell you which habits go with higher energy.",
  );
});

test("numbers and details read as plain words", () => {
  assert.deepEqual([0.184, -0.21, 0.004].map(percent), ["+18%", "−21%", "0%"]);
  assert.deepEqual(activityDetail("Energy", finding(gym, -0.14, 34, 20)), [
    "Energy averages 3.0 on Gym days and 3.5 on other days.",
    "Based on 34 Gym days and 20 other days.",
  ]);
  assert.deepEqual(activityDetail("Energy", finding(gym, null, 1)), [
    "1 Gym day with a check-in so far.",
    "4 more days and this row gets a number.",
  ]);
  assert.equal(moreWaiting(1), "1 more needs more days");
  assert.equal(moreWaiting(5), "5 more need more days");
  assert.equal(
    countUp(4),
    "4 of 7 check-ins. 3 more and I can start looking for patterns.",
  );
});

test("the trend is one line of words", () => {
  const line = (trend: number | null, currentAverage: number | null = 3) =>
    trendLine({ trend, currentAverage });
  assert.equal(line(-3.6), "A little lower than last week");
  assert.equal(line(4), "A little higher than last week");
  assert.equal(line(1.9), "About the same as last week");
  assert.equal(line(-12), "Lower than last week");
  assert.equal(line(25), "Higher than last week");
  assert.equal(line(null), "Nothing from last week to compare with");
  assert.equal(line(null, null), "No check-ins this week yet");
});

test("the weekday line names whichever days stand apart", () => {
  assert.equal(
    weekdayLine("Saturday", "Tuesday"),
    "Highest on Saturdays, lowest on Tuesdays",
  );
  assert.equal(weekdayLine("Saturday"), "Highest on Saturdays");
  assert.equal(weekdayLine(undefined, "Tuesday"), "Lowest on Tuesdays");
});
