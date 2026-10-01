import { test } from "node:test";
import assert from "node:assert/strict";
import { circleStatusLine, pastWeeksLine, weekBars, weekChipLabel } from "../src/features/circles/model";
import { notificationRoute } from "../src/native/notification-routing";

test("a circle log's chip says how far into the week it was", () => {
  assert.deepEqual(weekChipLabel({ done: 1, target: 4 }), { text: "1 of 4 this week", done: false });
  assert.deepEqual(weekChipLabel({ done: 4, target: 4 }), { text: "Week done ✅ 4 of 4", done: true });
  assert.deepEqual(weekChipLabel({ done: 6, target: 4 }), { text: "Week done ✅ +2", done: true });
});

test("past weeks row says the streak together and where you stand", () => {
  assert.equal(pastWeeksLine(2, 100), "2 🔥 weeks together · you're at 100%");
  assert.equal(pastWeeksLine(1, undefined), "1 🔥 week together");
  assert.equal(pastWeeksLine(0, 63), "you're at 63%");
  assert.equal(pastWeeksLine(0, undefined), "See how the circle is doing");
});

test("past weeks chart has one bar per finished week, then the week in progress", () => {
  const member = (id: string, done: number, pending = false) => ({
    user: { id, name: id, username: id, picture: null },
    plan: { id: `${id}-plan`, goal: "Run", emoji: "🏃" },
    role: "MEMBER" as const,
    joinedAt: "2026-08-01",
    week: { target: 4, done, daysLeft: 3, toGo: 4 - done, behind: false, isNew: false },
    hasIntro: true,
    pending,
    nudgedToday: false,
  });
  const bars = weekBars(
    {
      weeks: [
        { start: "2026-09-13", allHit: true, people: [{ userId: "rita", done: 4, target: 4, hit: true }] },
        {
          start: "2026-09-20",
          allHit: false,
          people: [
            { userId: "jonas", done: 1, target: 4, hit: false },
            { userId: "rita", done: 5, target: 4, hit: true },
          ],
        },
      ],
      ranking: [],
    },
    [member("rita", 2), member("jonas", 0), member("waiting", 0, true)],
  );
  assert.deepEqual(bars.map((b) => [b.label, b.current, b.target]), [["13", false, 4], ["20", false, 8], ["Now", true, 8]]);
  // Slices follow the board's order, whatever order the week came in.
  assert.deepEqual(bars[1].segments, [{ userId: "rita", done: 5 }, { userId: "jonas", done: 1 }]);
  assert.deepEqual(bars[2].segments, [{ userId: "rita", done: 2 }, { userId: "jonas", done: 0 }]);
});

test("home square says how the circle's week is going", () => {
  const base = { id: "c", name: "Morning 10K", emoji: "🏃", planId: "p", hasIntro: true, pending: false, people: [] };
  assert.equal(circleStatusLine({ ...base, status: "ACTIVE", memberCount: 5, onTrack: 4, daysLeft: 2 }), "4 of 5 on track · 2 days left");
  assert.equal(circleStatusLine({ ...base, status: "FORMING", memberCount: 1, onTrack: 1, daysLeft: 5 }), "Forming · 1 of 2");
  // Until the first photo log, the square says what gets you in.
  assert.equal(circleStatusLine({ ...base, pending: true, status: "ACTIVE", memberCount: 4, onTrack: 3, daysLeft: 2 }), "Post a photo to join");
});

test("circle notifications and invite links open in the app", () => {
  assert.equal(notificationRoute("/circle/abc123"), "/circle/abc123");
  assert.equal(notificationRoute("https://app.tracking.so/circle-invite/9f1c"), "/circle-invite/9f1c");
  assert.equal(notificationRoute("/circle/abc/../../settings"), null);
});
