import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import type { CoachMonitoringState } from "@tsw/prisma/follow-through";
import type {
  MonitoringInput,
  MonitoringDecision,
  MonitoringMessageMetadata,
} from "./types";
import { dueForSession } from "../../follow-through/model";
import { planPace } from "@tsw/prisma/follow-through/pace";

const DAY = 86400000;
export const monitoringState = (): CoachMonitoringState => ({
  requests: [],
  reviewed: {},
  consideredEntries: {},
  pausedPlanIds: [],
});
export function activeMonitoringPlans(input: MonitoringInput) {
  return input.plans.filter((p) => {
    const s = input.supports[p.id];
    return (
      s?.coaching &&
      s.coaching.role !== "tracking" &&
      !p.isPaused &&
      !p.archivedAt &&
      !p.deletedAt &&
      (!p.finishingDate ||
        p.finishingDate.toISOString().slice(0, 10) >=
          formatInTimeZone(input.now, s.timezone, "yyyy-MM-dd"))
    );
  });
}
const union = (a: string[] = [], b: string[]) => [...new Set([...a, ...b])];

/**
 * Settle open coach questions. What silence means depends on the plan's role:
 * - training: an unanswered "did your session happen?" counts as missed after a day
 * - consistency (with follow-ups on): after going quiet, the coach owes one "remember why you started / archive?" message
 * - everything else (and an ignored archive offer): contact pauses; the plan stays as it is
 */
export function resolveRequests(input: MonitoringInput) {
  const { state, now } = input;
  const active = new Set(activeMonitoringPlans(input).map((p) => p.id));
  for (const request of state.requests) {
    if (request.resolvedAt || request.closedAt || !request.requiresReply)
      continue;
    if (!request.planIds.some((id) => active.has(id))) {
      request.closedAt = now.toISOString();
      continue;
    }
    const askedAt = Date.parse(request.createdAt);
    // A reply in the plan's own thread, or in the unfiltered "All" thread, answers it.
    const replied = input.messages.some(
      (m) =>
        m.role === "USER" &&
        m.createdAt.getTime() > askedAt &&
        (!m.planId || request.planIds.includes(m.planId)),
    );
    const session = request.sessionId
      ? input.sessions.find((s) => s.id === request.sessionId)
      : undefined;
    const recorded = !!session && session.outcome !== "UNCONFIRMED";
    const proposals = input.messages.flatMap((m) => {
      const meta = m.metadata as MonitoringMessageMetadata | null;
      return m.id === request.messageId || meta?.coachRequestId === request.id
        ? (meta?.planProposals ?? [])
        : [];
    });
    const decided = proposals.length > 0 && proposals.every((p) => !!p.status);
    // Logging the habit again answers a nudge about it. It never marks an earlier session done.
    const resumedPractice =
      (request.kind === "lapse" ||
        (request.kind === "review" && !proposals.length)) &&
      input.entries.some(
        (e) =>
          e.datetime.getTime() > askedAt &&
          e.datetime <= now &&
          input.plans.some(
            (p) =>
              request.planIds.includes(p.id) &&
              p.activityIds.includes(e.activityId ?? ""),
          ),
      );
    if (replied || decided || recorded || resumedPractice) {
      request.resolvedAt = now.toISOString();
      continue;
    }

    const silentFor =
      now.getTime() - Date.parse(request.reminderAt ?? request.createdAt);
    if (request.kind === "session") {
      if (silentFor < DAY) continue;
      request.closedAt = now.toISOString();
      if (session && input.supports[session.planId]?.coaching?.role === "training") {
        session.outcome = "SKIPPED";
        session.assumedMissed = true;
      }
      continue;
    }
    if (silentFor < 7 * DAY) continue;
    request.closedAt = now.toISOString();
    const lapsing =
      request.kind === "lapse"
        ? []
        : request.planIds.filter(
            (id) =>
              input.supports[id]?.coaching?.role === "consistency" &&
              input.supports[id].coaching!.followUps,
          );
    state.lapsePlanIds = union(state.lapsePlanIds, lapsing);
    state.pausedPlanIds = union(
      state.pausedPlanIds,
      request.planIds.filter((id) => !lapsing.includes(id)),
    );
  }
}

/** Contact eligibility is deterministic. The generator decides what is useful inside these limits. */
export function decideMonitoring(
  input: MonitoringInput,
): MonitoringDecision | null {
  resolveRequests(input);
  const { now, state, supports } = input;
  if (
    !input.entitled ||
    (state.lease && Date.parse(state.lease.until) > now.getTime())
  )
    return null;
  const plans = activeMonitoringPlans(input).filter(
    (p) => !state.pausedPlanIds.includes(p.id),
  );
  if (!plans.length) return null;
  const withinWindow = (id: string) => {
    const s = supports[id];
    const today = formatInTimeZone(now, s.timezone, "yyyy-MM-dd");
    const at = fromZonedTime(
      `${today}T${s.preferences.reviewTime}:00`,
      s.timezone,
    );
    return at <= now && now.getTime() - at.getTime() < 3600000;
  };
  // An explicit request to design a new plan does not wait for a weekly review.
  const setup = plans.find(
    (p) =>
      state.setupPlanIds?.includes(p.id) &&
      supports[p.id].coaching?.role === "training",
  );
  const awaitingReply = state.requests.some(
    (request) => request.requiresReply && !request.resolvedAt && !request.closedAt,
  );
  const recentConversation = input.messages.some(
    (message) => message.createdAt.getTime() > now.getTime() - 30 * 60000,
  );
  if (setup && !awaitingReply && !recentConversation)
    return {
      id: `setup:${setup.id}:${state.requests.filter(
        (request) => request.kind === "setup" && request.planIds.includes(setup.id),
      ).length + 1}`,
      kind: "setup",
      planIds: [setup.id],
    };
  if (state.outreachPaused) return null;
  // Allow an in-flight/user-initiated conversation to finish before a proactive review.
  if (recentConversation) return null;

  // A coached plan that is slipping gets a silent nudge: the homepage card turns yellow and the
  // message is ready in Messages, with no push. Ignored nudges escalate through the normal
  // reminder (after 3 days) and lapse/pause rules below. At most one nudge per plan a week.
  const slipping = plans.find(
    (p) =>
      supports[p.id].coaching?.role !== "tracking" &&
      supports[p.id].coaching?.followUps &&
      !awaitingReply &&
      // Already further along: owed the "why you started / archive?" message instead.
      !state.lapsePlanIds?.includes(p.id) &&
      !state.requests.some(
        (r) =>
          r.kind === "nudge" &&
          r.planIds.includes(p.id) &&
          now.getTime() - Date.parse(r.createdAt) < 7 * DAY,
      ) &&
      planPace({
        timesPerWeek: p.timesPerWeek,
        startedAt: p.createdAt,
        now,
        logDates: input.entries
          .filter((e) => p.activityIds.includes(e.activityId ?? ""))
          .map((e) => e.datetime),
      }) === "slipping",
  );
  if (slipping)
    return {
      id: `nudge:${slipping.id}:${formatInTimeZone(now, supports[slipping.id].timezone, "yyyy-MM-dd")}`,
      kind: "nudge",
      planIds: [slipping.id],
    };
  if (
    state.lastOutreachAt &&
    now.getTime() - Date.parse(state.lastOutreachAt) < DAY
  )
    return null;
  if (
    input.legacyLastOutreachAt &&
    now.getTime() - Date.parse(input.legacyLastOutreachAt) < DAY
  )
    return null;
  const waiting = state.requests.find(
    (r) => r.requiresReply && !r.resolvedAt && !r.closedAt,
  );
  if (waiting) {
    const eligible = waiting.planIds.filter(
      (id) =>
        plans.some((p) => p.id === id) && supports[id].coaching?.followUps,
    );
    if (
      waiting.kind !== "session" &&
      waiting.kind !== "lapse" &&
      !waiting.reminderAt &&
      now.getTime() - Date.parse(waiting.createdAt) >= 3 * DAY &&
      eligible.some(withinWindow)
    )
      return {
        id: `reminder:${waiting.id}`,
        kind: "reminder",
        planIds: eligible,
        requestId: waiting.id,
      };
    return null;
  }
  // A habit that went quiet: one honest nudge with an archive offer, at the review hour.
  // Logging it again in the meantime cancels the nudge.
  const lapsed = plans.filter((p) => state.lapsePlanIds?.includes(p.id));
  const cameBack = lapsed.filter((p) =>
    input.entries.some(
      (e) =>
        p.activityIds.includes(e.activityId ?? "") &&
        now.getTime() - e.datetime.getTime() < 7 * DAY,
    ),
  );
  if (cameBack.length)
    state.lapsePlanIds = state.lapsePlanIds!.filter(
      (id) => !cameBack.some((p) => p.id === id),
    );
  const lapseNow = lapsed.filter(
    (p) => !cameBack.includes(p) && withinWindow(p.id),
  );
  if (lapseNow.length) {
    const planIds = lapseNow.map((p) => p.id).sort();
    return {
      id: `lapse:${formatInTimeZone(now, supports[planIds[0]].timezone, "yyyy-MM-dd")}:${planIds.join(",")}`,
      kind: "lapse",
      planIds,
    };
  }
  const due = plans.filter((p) => {
    const s = supports[p.id];
    if (!s.preferences.coaching || !s.preferences.weeklyReview) return false;
    const today = formatInTimeZone(now, s.timezone, "yyyy-MM-dd");
    const day = new Date(`${today}T12:00:00Z`).getUTCDay();
    if (day !== s.preferences.reviewDay || state.reviewed[p.id] === today)
      return false;
    const at = fromZonedTime(
      `${today}T${s.preferences.reviewTime}:00`,
      s.timezone,
    );
    return at <= now && now.getTime() - at.getTime() < 4 * 3600000;
  });
  if (due.length) {
    const planIds = due.map((p) => p.id).sort();
    const dueKey = formatInTimeZone(
      now,
      supports[planIds[0]].timezone,
      "yyyy-MM-dd",
    );
    return {
      id: `review:${dueKey}:${planIds.join(",")}`,
      kind: "review",
      planIds,
      dueKey,
    };
  }
  if (
    state.lastExtraAt &&
    now.getTime() - Date.parse(state.lastExtraAt) < 7 * DAY
  )
    return null;
  const entry = [...input.entries]
    .reverse()
    .find(
      (e) =>
        ["hard", "very_hard"].includes(e.difficulty ?? "") &&
        !!e.privateNotes?.trim() &&
        e.updatedAt <= now &&
        now.getTime() - e.updatedAt.getTime() < 3 * DAY &&
        state.consideredEntries[e.id] !== e.updatedAt.toISOString() &&
        plans.some(
          (p) =>
            p.activityIds.includes(e.activityId ?? "") &&
            supports[p.id].coaching?.followUps &&
            withinWindow(p.id),
        ),
    );
  if (entry) {
    const planIds = plans
      .filter(
        (p) =>
          p.activityIds.includes(entry.activityId ?? "") &&
          supports[p.id].coaching?.followUps &&
          withinWindow(p.id),
      )
      .map((p) => p.id);
    return {
      id: `difficulty:${entry.id}:${entry.updatedAt.toISOString()}`,
      kind: "difficulty",
      planIds,
      entryId: entry.id,
    };
  }
  const session = input.sessions.find((s) => {
    const support = supports[s.planId];
    if (
      !plans.some((p) => p.id === s.planId) ||
      !support.preferences.checkIn ||
      !support.coaching?.followUps ||
      s.outcome !== "UNCONFIRMED" ||
      s.timerRunning ||
      state.requests.some((r) => r.sessionId === s.id)
    )
      return false;
    const due = dueForSession(s, support).check;
    return !!due && due <= now && now.getTime() - due.getTime() < 3600000;
  });
  return session
    ? {
        id: `session:${session.id}`,
        kind: "session",
        planIds: [session.planId],
        sessionId: session.id,
      }
    : null;
}
