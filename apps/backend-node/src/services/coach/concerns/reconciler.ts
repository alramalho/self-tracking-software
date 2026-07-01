import { CoachConcern } from "@tsw/prisma";
import { TZDate } from "@date-fns/tz";
import { coachConcernService } from "./service";
import { computeActiveLenses, type ReviewLens } from "./lenses";
import { isWithinPreferredCoachWindow } from "./time";
import type { DetectorUser } from "./detectors";

// At most this many concerns are folded into a single outbound message.
const MAX_BATCH = 3;

// Per-kind escalation cadence: hours to wait before re-raising a still-unresolved
// concern, indexed by how many times it has already been raised. Once the list is
// exhausted the concern is marked ESCALATED and parked (no further automatic
// raises) until an action (archive/pause) or the user resolves it.
// NOTE: starting defaults — tune against the real backtest before shipping.
const DEFAULT_ESCALATION_DELAYS_HOURS = [24, 48];
const ATTENTION_ESCALATION_DELAYS_HOURS = [48, 96]; // attention_* nudges every ~2 days, not daily
const ESCALATION_DELAYS_BY_KIND: Record<string, number[]> = {
  // Stalled-plan concerns: nudge less often, they resolve on a slower timescale.
  inactivity_checkin: [72],
  inactivity_pause: [48, 96],
  inactivity_archive: [48, 96],
  plan_adjustment: [48, 96],
  // Metric-logging nudge: one-and-done. Raise once, then park (it auto-resolves
  // the moment the user logs a metric).
  metric_logging_gap: [],
};
const PARK_HOURS = 365 * 24;

function escalationDelaysFor(kind: string): number[] {
  if (kind in ESCALATION_DELAYS_BY_KIND) return ESCALATION_DELAYS_BY_KIND[kind];
  if (kind.startsWith("attention_")) return ATTENTION_ESCALATION_DELAYS_HOURS;
  return DEFAULT_ESCALATION_DELAYS_HOURS;
}

export interface DispatchInput {
  user: DetectorUser;
  now: Date;
  // The single message addresses these due concerns (problems) framed through
  // these active lenses (angles). Either may be empty, but not both.
  concerns: CoachConcern[];
  lenses: ReviewLens[];
}

export interface DispatchOutcome {
  messageId?: string | null;
  notificationId?: string | null;
}

// The reconciler decides WHAT to raise and WHEN; the sink turns that decision
// into an actual message/notification (real sink) or records it (dry sink, used
// by the backtest). Keeps the gating logic free of the LLM and live DB writes.
export interface DispatchSink {
  dispatch(input: DispatchInput): Promise<DispatchOutcome>;
}

// "Did we proactively contact this user, and when?" Decoupled from concerns so a
// lens-only message (which raises no concern) still counts. Prod reads the last
// autonomous COACH notification; the backtest uses an in-memory log.
export interface ContactLog {
  lastContactAt(userId: string): Promise<Date | null>;
  record(userId: string, now: Date): Promise<void>;
}

export interface ReconcileResult {
  dispatched: boolean;
  reason:
    | "dispatched"
    | "outside_window"
    | "already_contacted_this_window"
    | "nothing_to_say";
  concerns?: CoachConcern[];
  lenses?: ReviewLens[];
}

function isOutboundWindow(user: DetectorUser, now: Date): boolean {
  return isWithinPreferredCoachWindow(user, now);
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

// Start of the current contact window (today at preferredCoachingHour, user tz).
function windowStart(user: DetectorUser, now: Date): Date {
  const start = new TZDate(now, user.timezone || "UTC");
  start.setHours(user.preferredCoachingHour ?? 6, 0, 0, 0);
  return new Date(start.getTime());
}

// Advance one concern's lifecycle after it has been folded into an outbound
// message: each raise consumes the next escalation delay; once exhausted the
// concern is marked ESCALATED and parked.
async function advanceLifecycle(
  concern: CoachConcern,
  now: Date,
  outcome: DispatchOutcome
): Promise<void> {
  const delays = escalationDelaysFor(concern.kind);
  const delayHours = delays[concern.raisedCount];
  const exhausted = delayHours === undefined;
  await coachConcernService.markRaised(
    concern.id,
    {
      status: exhausted ? "ESCALATED" : "RAISED",
      messageId: outcome.messageId,
      notificationId: outcome.notificationId,
      nextEligibleAt: addHours(now, exhausted ? PARK_HOURS : delayHours),
    },
    now
  );
}

// One outbound reconcile for a user. Sends at most ONE message per contact
// window, merging the top due concerns with any active lenses, then advances
// each folded concern's lifecycle. This is the single place a proactive message
// originates.
export async function runOutboundReconcile(
  user: DetectorUser,
  now: Date,
  sink: DispatchSink,
  contactLog: ContactLog,
  options: { force?: boolean } = {}
): Promise<ReconcileResult> {
  if (!options.force && !isOutboundWindow(user, now)) {
    return { dispatched: false, reason: "outside_window" };
  }

  // One message per window.
  if (!options.force) {
    const lastContact = await contactLog.lastContactAt(user.id);
    if (lastContact && lastContact >= windowStart(user, now)) {
      return { dispatched: false, reason: "already_contacted_this_window" };
    }
  }

  const due = await coachConcernService.getDue(user.id, now); // severity desc, oldest first
  const lenses = await computeActiveLenses(user, now);
  if (due.length === 0 && lenses.length === 0) {
    return { dispatched: false, reason: "nothing_to_say" };
  }

  const batch = due.slice(0, MAX_BATCH);
  const outcome = await sink.dispatch({ user, now, concerns: batch, lenses });

  for (const concern of batch) {
    await advanceLifecycle(concern, now, outcome);
  }
  await contactLog.record(user.id, now);

  return { dispatched: true, reason: "dispatched", concerns: batch, lenses };
}
