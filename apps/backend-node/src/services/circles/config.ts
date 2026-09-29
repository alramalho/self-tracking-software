// Size rules: matching fills a circle up to 5, invites up to 8, and the board starts at 3.
export const MATCHING_TARGET = 5;
export const CIRCLE_CAP = 8;
export const ACTIVE_AT = 3;

// Few users per goal for now, so matching starts wide: a low bar that relaxes after 3 days.
export const MATCH_THRESHOLD = 0.45;
export const RELAXED_THRESHOLD = 0.35;
export const RELAX_AFTER_DAYS = 3;
export const STALLED_AFTER_DAYS = 7;

// A lever counts as a "why" chip when it scores at least this for everyone involved.
export const REASON_MIN = 0.6;

export const LEVER_WEIGHTS = {
  goal: 0.45,
  pace: 0.25,
  place: 0.15,
  age: 0.15,
} as const;

// Nudges: one per sender and receiver per day, at most three received per day.
export const NUDGES_RECEIVED_PER_DAY = 3;

// Sunday recap goes out at this local hour.
export const RECAP_HOUR = 19;

// People who haven't opened the app in this long aren't matched.
export const ACTIVE_WITHIN_DAYS = 14;

// Joining needs proof: the first photo log on the plan. One coach reminder after a day,
// and the spot is released after a week.
export const PROOF_NUDGE_AFTER_HOURS = 24;
export const PENDING_EXPIRES_AFTER_DAYS = 7;
