import { addDays, format, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import type { FollowThroughState, PlanPause } from "@tsw/prisma/follow-through";
import { prisma } from "../../../utils/prisma";
import { logger } from "../../../utils/logger";
import { changeState } from "../../follow-through/store";
import { FollowThroughInputError } from "../../follow-through/errors";
import { monitoringState } from "../monitoring/model";
import { zoned } from "./commitment";
import { MAX_PAUSE_DAYS } from "./service";

/**
 * "Pause until Monday", tapped after the coach offered it (27 Nov 2026: the owner had a fresh tattoo, the coach
 * only said "Let the tattoo heal" and nothing on the plan changed). The plan is paused through that day, so its
 * card and calendar show it, and it picks up again by itself the day after. The coach stays quiet until then
 * and checks in once that morning, like after a trip. The streak is untouched: missed weeks still count.
 */
export async function pausePlanUntil(userId: string, planId: string, until: string, now = new Date()) {
  const [user, plan, row] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { timezone: true } }),
    prisma.plan.findFirst({ where: { id: planId, userId, deletedAt: null }, select: { pauseHistory: true, isPaused: true } }),
    prisma.coachingState.findUnique({ where: { userId }, select: { data: true } }),
  ]);
  if (!plan) throw new FollowThroughInputError("Plan not found");
  const support = (row?.data as FollowThroughState | undefined)?.supports?.[planId];
  const clock = { timezone: support?.timezone || user.timezone || "Europe/Berlin", morning: support?.preferences.dayReminderTime ?? "09:00" };
  const today = formatInTimeZone(now, clock.timezone, "yyyy-MM-dd");
  const latest = format(addDays(parseISO(today), MAX_PAUSE_DAYS), "yyyy-MM-dd");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(until) || until <= today || until > latest)
    throw new FollowThroughInputError("Pick a day within the next two weeks");

  const backOn = format(addDays(parseISO(until), 1), "yyyy-MM-dd");
  const history = (plan.pauseHistory as PlanPause[] | null) ?? [];
  const open = plan.isPaused ? history.at(-1) : undefined;
  const pause: PlanPause = {
    pausedAt: open?.pausedAt ?? now.toISOString(),
    resumedAt: null,
    reason: "coach",
    until,
    resumeAt: zoned(backOn, "00:00", clock).toISOString(),
  };
  await prisma.plan.update({
    where: { id: planId },
    data: { isPaused: true, pauseReason: "coach", pauseHistory: [...(open ? history.slice(0, -1) : history), pause] as never },
  });
  await changeState(userId, async (state) => {
    const monitoring = (state.monitoring ??= monitoringState());
    monitoring.quiet = { ...monitoring.quiet, [planId]: { until, why: "paused", at: now.toISOString() } };
    monitoring.reminders = (monitoring.reminders ?? []).filter((r) => r.planId !== planId || r.sentAt);
    monitoring.reminders.push({ planId, dueAt: zoned(backOn, clock.morning, clock).toISOString(), kind: "return", bookedAt: now.toISOString() });
  });
  return { until, backOn };
}

/** Plans whose coach pause has run out pick up again (the hourly job). Pauses without an end stay. */
export async function resumeDuePauses(now = new Date()) {
  const paused = await prisma.plan.findMany({ where: { isPaused: true, deletedAt: null }, select: { id: true, pauseHistory: true } });
  for (const plan of paused) {
    const history = (plan.pauseHistory as PlanPause[] | null) ?? [];
    const last = history.at(-1);
    if (!last?.resumeAt || last.resumedAt || Date.parse(last.resumeAt) > now.getTime()) continue;
    await prisma.plan.update({
      where: { id: plan.id },
      data: { isPaused: false, pauseReason: null, pauseHistory: [...history.slice(0, -1), { ...last, resumedAt: last.resumeAt }] as never },
    });
    logger.info(`Plan ${plan.id} picked up again after its pause through ${last.until}`);
  }
}

/** "Resume plan" before the day: the coach's quiet for the pause ends with it. */
export async function endPauseQuiet(userId: string, planId: string) {
  await changeState(userId, async (state) => {
    if (state.monitoring?.quiet?.[planId]?.why !== "paused") return;
    delete state.monitoring.quiet[planId];
    state.monitoring.reminders = (state.monitoring.reminders ?? []).filter((r) => r.planId !== planId || r.sentAt || r.kind !== "return");
  });
}
