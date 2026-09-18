import { FollowThroughInputError } from "./errors";
import { randomUUID } from "node:crypto";
import type { User } from "@tsw/prisma";
import type {
  FollowThroughSnapshot,
  PlanSupport,
  SessionOutcome,
} from "@tsw/prisma/follow-through";
import { changeState, ownedPlans, recentEntries } from "./store";
import {
  dueForSession,
  instant,
  localDate,
  calendarDay,
  isActive,
  materialize,
  sessionFor,
  updateSilence,
  reconcileEntries,
} from "./model";

export const canCoach = (user: Pick<User, "planType">) =>
  user.planType !== "FREE";
export async function snapshot(user: User): Promise<FollowThroughSnapshot> {
  return changeState(user.id, async (state, tx) => {
    const now = new Date();
    const plans = await ownedPlans(user.id, tx);
    // Display existing prescribed sessions with all new reach-outs off by default.
    for (const plan of plans)
      if (!state.supports[plan.id] && plan.sessions.length) {
        state.supports[plan.id] = {
          planId: plan.id,
          mode: "WEEKLY",
          weekdays: [],
          time: null,
          timezone: user.timezone || "UTC",
          durationMinutes: 20,
          format: "LOG",
          resourceUrl: null,
          resourceName: null,
          nextStep: "",
          effectiveDate: localDate(now, user.timezone || "UTC"),
          preferences: {
            coaching: false,
            reminder: false,
            reminderMinutes: 30,
            dayReminderTime: "09:00",
            checkIn: false,
            checkInTime: "10:00",
            weeklyReview: false,
            reviewDay: 0,
            reviewTime: "18:00",
          },
        };
      }
    materialize(state, plans, now);
    reconcileEntries(state, await recentEntries(user.id, tx), now);
    updateSilence(state, now);
    return { state, canCoach: canCoach(user), serverTime: now.toISOString() };
  });
}
export async function configure(user: User, support: PlanSupport) {
  return changeState(user.id, async (state, tx) => {
    const plan = await tx.plan.findFirst({
      where: {
        id: support.planId,
        userId: user.id,
        deletedAt: null,
        archivedAt: null,
      },
    });
    if (!plan) throw new FollowThroughInputError("Plan not found");
    if (support.preferences.coaching && !canCoach(user))
      throw new FollowThroughInputError(
        "Coaching requires an active subscription or trial",
      );
    if (
      support.mode !== "WEEKLY" &&
      plan.timesPerWeek &&
      support.weekdays.length > plan.timesPerWeek
    )
      throw new FollowThroughInputError(
        "Choose no more days than your weekly target, or update the target first",
      );
    const today = localDate(new Date(), support.timezone);
    if (support.effectiveDate < today) support.effectiveDate = today;
    const old = state.supports[plan.id];
    const changedSchedule =
      old &&
      (old.mode !== support.mode ||
        old.time !== support.time ||
        old.timezone !== support.timezone ||
        old.weekdays.join() !== support.weekdays.join());
    if (changedSchedule)
      for (const [id, session] of Object.entries(state.sessions)) {
        if (
          session.planId === plan.id &&
          session.source === "RECURRING" &&
          session.date >= today &&
          session.outcome === "UNCONFIRMED" &&
          !session.startedAt &&
          !session.movedFrom
        ) {
          delete state.sessions[id];
          for (const check of Object.values(state.checks))
            if (check.sessionId === id && !check.answeredAt)
              check.dismissedAt = new Date().toISOString();
        }
      }
    for (const check of Object.values(state.checks))
      if (
        check.planId === plan.id &&
        check.kind === "WEEKLY" &&
        !check.answeredAt
      )
        check.answeredAt = new Date().toISOString();
    state.supports[plan.id] = support;
    state.enabled = true;
    // The explicit session workflow replaces generic autonomous nudges/auto-accept for this account.
    await tx.user.update({
      where: { id: user.id },
      data: { proactiveCoachingEnabled: false },
    });
    materialize(state, await ownedPlans(user.id, tx), new Date());
    return support;
  });
}
export async function createSession(
  user: User,
  planId: string,
  date: string,
  time: string | null,
) {
  return changeState(user.id, async (state, tx) => {
    const plan = (await ownedPlans(user.id, tx)).find(
      (p) => p.id === planId && !p.isPaused,
    );
    const support = state.supports[planId];
    if (!plan || !support)
      throw new FollowThroughInputError(
        "Set up this plan’s session preferences first",
      );
    if (support.mode === "WEEKLY" && plan.outlineType !== "SPECIFIC")
      throw new FollowThroughInputError(
        "This plan is flexible. Log an activity whenever you want; no session is needed.",
      );
    if (!isActive(plan, date))
      throw new FollowThroughInputError("This plan is not active on that date");
    const today = localDate(new Date(), support.timezone);
    if (date < calendarDay(today, -14) || date > calendarDay(today, 35))
      throw new FollowThroughInputError(
        "Choose a session within the next five weeks, or the past two weeks",
      );
    const activity = plan.activities.find((a) => !a.deletedAt);
    if (!activity)
      throw new FollowThroughInputError(
        "Choose an activity for this plan first",
      );
    if (time && !instant(date, time, support.timezone))
      throw new FollowThroughInputError(
        "That time is unavailable in your timezone",
      );
    const session = sessionFor(
      randomUUID(),
      planId,
      activity.id,
      date,
      support,
      "SPONTANEOUS",
    );
    session.time = time;
    state.sessions[session.id] = session;
    for (const check of Object.values(state.checks))
      if (
        check.planId === plan.id &&
        check.kind === "WEEKLY" &&
        !check.answeredAt
      )
        check.answeredAt = new Date().toISOString();
    return session;
  });
}
export async function timer(
  userId: string,
  id: string,
  action: "START" | "PAUSE" | "FINISH",
) {
  return changeState(userId, async (state) => {
    const session = state.sessions[id];
    if (!session || session.outcome !== "UNCONFIRMED")
      throw new FollowThroughInputError("Session is no longer available");
    const now = new Date();
    if (action === "START") {
      if (
        Object.values(state.sessions).some((s) => s.id !== id && s.timerRunning)
      )
        throw new FollowThroughInputError(
          "Finish or pause your other timer first",
        );
      if (!session.timerRunning) {
        session.startedAt = now.toISOString();
        session.timerRunning = true;
      }
    } else if (session.timerRunning) {
      session.elapsedSeconds += Math.max(
        0,
        Math.floor((now.getTime() - Date.parse(session.startedAt!)) / 1000),
      );
      session.startedAt = null;
      session.timerRunning = false;
    }
    return session;
  });
}
export async function outcome(
  userId: string,
  id: string,
  value: SessionOutcome,
  entryId?: string,
) {
  return changeState(userId, async (state, tx) => {
    const session = state.sessions[id];
    if (!session) throw new FollowThroughInputError("Session not found");
    if (value === "DONE" || value === "PARTLY") {
      const entry =
        entryId &&
        (await tx.activityEntry.findFirst({
          where: {
            id: entryId,
            userId,
            deletedAt: null,
            activityId: session.activityId,
          },
        }));
      if (
        !entry ||
        localDate(entry.datetime, session.timezone) !== session.date
      )
        throw new FollowThroughInputError(
          "Choose a matching activity log for this session’s date",
        );
      if (
        Object.values(state.sessions).some(
          (s) => s.id !== id && s.entryId === entryId,
        )
      )
        throw new FollowThroughInputError(
          "That log already completes another session",
        );
      session.entryId = entry.id;
    }
    if (session.timerRunning && session.startedAt)
      session.elapsedSeconds += Math.max(
        0,
        Math.floor((Date.now() - Date.parse(session.startedAt)) / 1000),
      );
    session.timerRunning = false;
    session.startedAt = null;
    session.outcome = value;
    for (const check of Object.values(state.checks))
      if (check.sessionId === id) check.answeredAt = new Date().toISOString();
    return session;
  });
}
export async function move(
  userId: string,
  id: string,
  date: string,
  time: string | null,
) {
  return changeState(userId, async (state, tx) => {
    const session = state.sessions[id];
    if (!session || session.outcome !== "UNCONFIRMED" || session.timerRunning)
      throw new FollowThroughInputError(
        "Only an unstarted, unconfirmed session can be moved",
      );
    if (time && !instant(date, time, session.timezone))
      throw new FollowThroughInputError(
        "That time is unavailable in your timezone",
      );
    const today = localDate(new Date(), session.timezone);
    const plan = (await ownedPlans(userId, tx)).find(
      (p) => p.id === session.planId,
    );
    if (!plan || !isActive(plan, date))
      throw new FollowThroughInputError("This plan is not active on that date");
    if (date < today || date > calendarDay(today, 35))
      throw new FollowThroughInputError(
        "Choose a slot today or within the next five weeks",
      );
    session.movedFrom ??= session.date;
    session.date = date;
    session.time = time;
    for (const check of Object.values(state.checks))
      if (check.sessionId === id && !check.answeredAt)
        check.answeredAt = new Date().toISOString();
    return session;
  });
}
