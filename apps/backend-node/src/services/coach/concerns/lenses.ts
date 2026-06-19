import { TZDate } from "@date-fns/tz";
import { PlanSession } from "@tsw/prisma";
import { endOfDay, startOfDay } from "date-fns";
import {
  getCoachWeekBounds,
  getPreviousCoachWeekBounds,
} from "../../../utils/date";
import { prisma } from "../../../utils/prisma";
import {
  summarizePlanAdherenceAsOf,
  type DetectorPlan,
  type DetectorUser,
} from "./detectors";
import { isWithinPreferredCoachWindow } from "./time";

// A lens is NOT a stored problem. It is an ephemeral angle to assess the user
// through at this moment ("the week is ending — say closure words"), computed
// fresh each outbound opportunity, never escalating. The reconciler folds active
// lenses into the single outbound message as framing.
export const LENS_KIND = {
  WEEK_RECAP: "week_recap",
  WEEK_START: "week_start",
  SESSION_PREP: "session_prep",
  CELEBRATION: "celebration",
} as const;

export interface ReviewLens {
  kind: string;
  planId?: string | null;
  context: Record<string, unknown>;
}

function isWeekStartTime(user: DetectorUser, now: Date): boolean {
  const nowInTz = new TZDate(now, user.timezone || "UTC");
  const day = nowInTz.getDay();
  const hour = nowInTz.getHours();
  const preferredHour = user.preferredCoachingHour ?? 6;
  return (day === 0 && hour === 20) || (day === 1 && hour === preferredHour);
}

function sessionsBetween(
  plans: DetectorPlan[],
  start: Date,
  end: Date
): Array<{ plan: DetectorPlan; session: PlanSession }> {
  return plans.flatMap((plan) =>
    plan.sessions
      .filter((session) => session.date >= start && session.date <= end)
      .map((session) => ({ plan, session }))
  );
}

// Which angles are live for this user as-of `now`. Pure read; no writes.
export async function computeActiveLenses(
  user: DetectorUser,
  now: Date
): Promise<ReviewLens[]> {
  const timezone = user.timezone || "UTC";
  const nowInTz = new TZDate(now, timezone);
  const localHour = nowInTz.getHours();
  const lenses: ReviewLens[] = [];

  // Week-start angle: heads-up about the week's planned sessions.
  if (isWeekStartTime(user, now)) {
    const { start, end } = getCoachWeekBounds(now, timezone);
    const weekSessions = sessionsBetween(user.plans, start, end);
    if (weekSessions.length > 0) {
      lenses.push({
        kind: LENS_KIND.WEEK_START,
        context: { sessionCount: weekSessions.length },
      });
    }
  }

  // Session-prep angle (8pm): tomorrow's sessions.
  if (localHour === 20) {
    const tomorrow = new TZDate(now, timezone);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowSessions = sessionsBetween(
      user.plans,
      startOfDay(tomorrow),
      endOfDay(tomorrow)
    );
    if (tomorrowSessions.length > 0) {
      lenses.push({
        kind: LENS_KIND.SESSION_PREP,
        context: { sessionCount: tomorrowSessions.length },
      });
    }
  }

  // Week-recap angle (Monday morning): reflect on last week's activity.
  if (nowInTz.getDay() === 1 && isWithinPreferredCoachWindow(user, now)) {
    const { start: prevStart, end: prevEnd } = getPreviousCoachWeekBounds(
      now,
      timezone
    );
    const activityIds = user.plans.flatMap((p) => p.activities.map((a) => a.id));
    const entryCount =
      activityIds.length > 0
        ? await prisma.activityEntry.count({
            where: {
              userId: user.id,
              deletedAt: null,
              activityId: { in: activityIds },
              datetime: { gte: prevStart, lte: prevEnd },
            },
          })
        : 0;
    if (entryCount > 0) {
      lenses.push({ kind: LENS_KIND.WEEK_RECAP, context: { entryCount } });
    }
  }

  // Celebration angle: a plan whose every planned session this week is complete.
  for (const plan of user.plans) {
    const summary = await summarizePlanAdherenceAsOf(user, plan, now);
    if (
      summary.totalSessionsThisWeek > 0 &&
      summary.missedSessionsThisWeek === 0 &&
      summary.completedSessionsThisWeek === summary.totalSessionsThisWeek
    ) {
      lenses.push({
        kind: LENS_KIND.CELEBRATION,
        planId: plan.id,
        context: { ...summary },
      });
    }
  }

  return lenses;
}
