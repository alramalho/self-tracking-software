// The web app keeps its own copy of the Metrics calculation and sentences.
// This holds the two copies to the same answers for the same days.
import assert from "node:assert/strict";
import test from "node:test";
import { activityFindings } from "../src/features/metrics/model";
import * as words from "../src/features/metrics/words";
import { activityFindings as webFindings } from "../../frontend-vite/src/lib/metricFindings";
import * as webWords from "../../frontend-vite/src/lib/metricWords";
import type { Activity, ActivityEntry, MetricEntry } from "../src/core/types";

const activities = ["Gym", "Chess", "Running", "Sauna"].map(
  (title) => ({ id: title, title, emoji: "🏋️", measure: "sessions" }) as Activity,
);
const on = [
  (i: number) => i % 2 === 0,
  (i: number) => i % 5 === 1,
  (i: number) => i % 3 === 0,
  (i: number) => i === 4 || i === 9,
];
const metrics = Array.from(
  { length: 40 },
  (_, i) =>
    ({
      id: `m${i}`,
      metricId: "energy",
      rating: Math.min(5, (on[0](i) ? 2 : 4) + (on[1](i) ? 1 : 0)),
      skipped: i === 7,
      createdAt: new Date(Date.UTC(2026, 7, 1 + i)).toISOString(),
    }) as MetricEntry,
);
const entries = activities.flatMap((activity, index) =>
  Array.from({ length: 40 }, (_, i) => i)
    .filter(on[index])
    .map(
      (i) =>
        ({
          id: `${activity.id}-${i}`,
          activityId: activity.id,
          quantity: 1,
          datetime: new Date(2026, 7, 1 + i, 12).toISOString(),
        }) as ActivityEntry,
    ),
);

test("the web app and the iPhone app find the same things in the same days", () => {
  const app = activityFindings(metrics, activities, entries);
  // The web types come from the database schema; the fields read are the same.
  const web = webFindings(metrics as never, activities as never, entries as never);
  assert.equal(app.length, 4);
  assert.deepEqual(
    web.map((row) => [row.activity.id, row.difference, row.days, row.otherDays]),
    app.map((row) => [row.activity.id, row.difference, row.days, row.otherDays]),
  );
  assert.equal(
    webWords.headline("Energy", web),
    words.headline("Energy", app),
  );
  app.forEach((row, i) => {
    assert.deepEqual(
      webWords.activityDetail("Energy", web[i]),
      words.activityDetail("Energy", row),
    );
    assert.equal(
      webWords.waitingForActivity(web[i]),
      words.waitingForActivity(row),
    );
  });
});

test("the web app and the iPhone app use the same sentences", () => {
  assert.equal(webWords.CAVEAT, words.CAVEAT);
  assert.equal(webWords.countUp(4), words.countUp(4));
  for (const value of [0.184, -0.21, 0.004])
    assert.equal(webWords.percent(value), words.percent(value));
  for (const trend of [-12, -3.6, 1, 4, 25, null])
    assert.equal(
      webWords.trendLine({ trend, currentAverage: 3 }),
      words.trendLine({ trend, currentAverage: 3 }),
    );
  assert.equal(
    webWords.weekdayLine("Saturday", "Tuesday"),
    words.weekdayLine("Saturday", "Tuesday"),
  );
  for (const count of [3, 8, 20, 40])
    assert.equal(webWords.signalLine(count), words.signalLine(count, "day"));
});
