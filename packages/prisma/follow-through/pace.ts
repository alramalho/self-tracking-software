const DAY = 86_400_000;

export type PlanPace = "on_track" | "normal" | "slipping";

/**
 * How a plan is going, from its logs alone. Shared by the homepage card (ring colour)
 * and the coach (a silent nudge when slipping), so both always agree.
 * - slipping: nothing logged for longer than the plan's usual gap (7 ÷ weekly target, plus a day), and fewer
 *   than the weekly target in the last 7 days
 * - on_track: the weekly target was logged in the last 7 days
 */
export function planPace(input: {
  timesPerWeek: number | null | undefined;
  logDates: Date[];
  startedAt: Date;
  now: Date;
}): PlanPace {
  const target = Math.max(1, Math.min(7, input.timesPerWeek || 3));
  const allowedGapDays = Math.ceil(7 / target) + 1;
  const last = input.logDates.reduce(
    (latest, date) => (date > latest ? date : latest),
    input.startedAt,
  );
  const lastWeek = input.logDates.filter(
    (date) => input.now.getTime() - date.getTime() < 7 * DAY,
  ).length;
  // A gap only counts once the last 7 days also fell short: 4 sessions last week then 3 quiet days is a
  // rhythm, not a slip (13 Nov 2026, coach journeys benchmark).
  if (lastWeek < target && input.now.getTime() - last.getTime() > allowedGapDays * DAY) return "slipping";
  return lastWeek >= target ? "on_track" : "normal";
}

/**
 * "You're cutting it close this week": the weekly target still fits, but only if nearly every
 * remaining day is used. Out-of-reach and finished weeks are not at risk. Compared with the
 * slack the target normally leaves, so a 7x/week plan is not "at risk" all week.
 */
export function weekAtRisk(input: { target: number; doneDays: number; daysLeft: number }): boolean {
  const needed = input.target - input.doneDays;
  if (needed <= 0 || needed > input.daysLeft) return false;
  const spareDays = input.daysLeft - needed;
  return spareDays <= 1 && spareDays < 7 - input.target;
}

/**
 * The coach's "at risk" question: only when the weekly target needs every remaining day (13 Nov 2026).
 * "1 session left · 2 days to go" is still on schedule and asking "what got in the way?" then is noise;
 * the card's dashed dots (weekAtRisk) still show the week is getting close. Daily plans never qualify.
 */
export function weekOnTheLine(input: { target: number; doneDays: number; daysLeft: number }): boolean {
  const needed = input.target - input.doneDays;
  return input.target < 7 && needed > 0 && needed === input.daysLeft;
}
