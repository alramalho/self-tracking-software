import assert from "node:assert/strict";
import test from "node:test";
import {
  candidateDateLabel,
  relativeDateLabel,
  workoutDateRelation,
} from "../src/features/health/review/date";

const now = new Date("2026-09-15T12:00:00+01:00");

test("uses short relative dates for recent workout candidates", () => {
  assert.equal(relativeDateLabel("2026-09-15T08:00:00+01:00", now), "Today");
  assert.equal(
    relativeDateLabel("2026-09-14T08:00:00+01:00", now),
    "Yesterday",
  );
  assert.equal(
    relativeDateLabel("2026-09-13T08:00:00+01:00", now),
    "2 days ago",
  );
});

test("makes the candidate's day proximity to the Watch workout explicit", () => {
  assert.equal(
    workoutDateRelation(
      "2026-09-15T19:10:00+01:00",
      "2026-09-15T18:50:00+01:00",
    ),
    "Same day as Watch",
  );
  assert.equal(
    workoutDateRelation(
      "2026-09-14T19:10:00+01:00",
      "2026-09-15T18:50:00+01:00",
    ),
    "1 day before Watch",
  );
  assert.match(
    candidateDateLabel(
      "2026-09-15T19:10:00+01:00",
      "2026-09-15T18:50:00+01:00",
      now,
    ),
    /^Same day as Watch · Today,/,
  );
});
