import test from "node:test";
import assert from "node:assert/strict";
import {
  coachNoteText,
  isDailyCheckinDue,
  pickHomeCoachNote,
  plansNeedingDecision,
} from "@tsw/prisma/home-todo";

const now = new Date(2026, 9, 27, 12);
const hoursAgo = (hours: number) =>
  new Date(now.getTime() - hours * 3_600_000);
const recap = {
  id: "recap",
  content: "**Great week.** {{plan:p1|Run 5k}} is on track.",
  createdAt: hoursAgo(5),
  isUnread: true,
};

test("coach note shows a fresh unread recap as plain text", () => {
  assert.deepEqual(
    pickHomeCoachNote({ preview: recap, planType: "PLUS", now }),
    { id: "recap", text: "Great week. Run 5k is on track.", createdAt: recap.createdAt },
  );
});

test("coach note hides when read, stale, free, or opted out", () => {
  assert.equal(
    pickHomeCoachNote({ preview: { ...recap, isUnread: false }, now }),
    null,
  );
  assert.equal(
    pickHomeCoachNote({ preview: { ...recap, createdAt: hoursAgo(73) }, now }),
    null,
  );
  assert.equal(pickHomeCoachNote({ preview: recap, planType: "FREE", now }), null);
  assert.equal(
    pickHomeCoachNote({ preview: recap, proactiveCoachingEnabled: false, now }),
    null,
  );
  assert.equal(pickHomeCoachNote({ preview: null, now }), null);
});

test("coach note text drops markdown links and marks", () => {
  assert.equal(
    coachNoteText("## Hi\n\nSee [your plan](https://x.y) _today_"),
    "Hi See your plan today",
  );
});

test("plans needing a decision are ended or have no sessions left", () => {
  const plans = [
    { id: "ended", goal: "Old", finishingDate: new Date(2026, 9, 20) },
    { id: "empty", goal: "Gym", outlineType: "SPECIFIC", sessions: [{ date: new Date(2026, 9, 26) }] },
    { id: "today", goal: "Swim", outlineType: "SPECIFIC", sessions: [{ date: new Date(2026, 9, 27, 6) }] },
    { id: "weekly", goal: "Read", outlineType: "TIMES_PER_WEEK" },
    { id: "archived", goal: "Gone", finishingDate: new Date(2026, 0, 1), archivedAt: new Date() },
  ];
  assert.deepEqual(
    plansNeedingDecision(plans, now).map((plan) => [plan.planId, plan.reason]),
    [
      ["ended", "ended"],
      ["empty", "unscheduled"],
    ],
  );
});

test("daily check-in is due until every metric is rated or skipped today", () => {
  const metrics = [{ id: "mood" }, { id: "energy" }];
  const today = new Date(2026, 9, 27, 8);
  assert.equal(isDailyCheckinDue([], [], now), false);
  assert.equal(
    isDailyCheckinDue(metrics, [{ metricId: "mood", rating: 4, createdAt: today }], now),
    true,
  );
  assert.equal(
    isDailyCheckinDue(
      metrics,
      [
        { metricId: "mood", rating: 4, createdAt: today },
        { metricId: "energy", rating: 0, skipped: true, createdAt: today },
      ],
      now,
    ),
    false,
  );
  assert.equal(
    isDailyCheckinDue(
      metrics,
      [
        { metricId: "mood", rating: 4, createdAt: new Date(2026, 9, 26) },
        { metricId: "energy", rating: 4, createdAt: new Date(2026, 9, 26) },
      ],
      now,
    ),
    true,
  );
});
