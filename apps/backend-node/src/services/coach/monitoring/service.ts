import { createHash, randomUUID } from "node:crypto";
import { formatInTimeZone } from "date-fns-tz";
import { Prisma, type User } from "@tsw/prisma";
import type { FollowThroughState } from "@tsw/prisma/follow-through";
import { prisma } from "../../../utils/prisma";
import { hasAiConsent } from "../../../utils/aiConsent";
import { logger } from "../../../utils/logger";
import { healthSafeActivityFilter } from "../../health/apple/ai-boundary";
import { changeState } from "../../follow-through/store";
import { materialize, reconcileEntries } from "../../follow-through/model";
import { notificationService } from "../../notificationService";
import { toCoachConversationHistory } from "../../coachConversationHistoryService";
import { scheduledCoachGeneration } from "./generation/service";
import { decideMonitoring, monitoringState } from "./model";
import { runMonitoring } from "./run";
import type { MonitoringDecision } from "./types";
import { planProposalBasis } from "./proposal-basis";
import { fingerprintValue } from "./fingerprint";

async function readInput(
  tx: Prisma.TransactionClient,
  user: User,
  state: FollowThroughState,
  now: Date,
) {
  const [plans, entries, messages, account] = await Promise.all([
    tx.plan.findMany({
      where: { userId: user.id, deletedAt: null },
      include: { activities: true, sessions: true, milestones: true, curriculumFiles: true },
    }),
    tx.activityEntry.findMany({
      where: {
        ...healthSafeActivityFilter,
        userId: user.id,
        deletedAt: null,
        datetime: { gte: new Date(now.getTime() - 28 * 86400000) },
      },
      orderBy: { datetime: "asc" },
    }),
    tx.message.findMany({
      where: { chat: { userId: user.id, type: "COACH" } },
      orderBy: { createdAt: "desc" },
      take: 80,
    }),
    tx.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { planType: true, deletedAt: true },
    }),
  ]);
  state.monitoring ??= monitoringState();
  materialize(state, plans, now);
  reconcileEntries(state, entries, now);
  const grants = Object.values(state.supports).filter(
    (s) => s.coaching?.role !== "tracking",
  );
  const [workoutVersion, sleepVersion, syncVersion] = await Promise.all([
    grants.some((s) => s.coaching?.dataAccess.workouts)
      ? tx.healthWorkout.aggregate({
          where: { userId: user.id },
          _max: { updatedAt: true },
          _count: true,
        })
      : null,
    grants.some((s) => s.coaching?.dataAccess.sleep)
      ? tx.healthDailyMetric.aggregate({
          where: { userId: user.id },
          _max: { updatedAt: true },
          _count: true,
        })
      : null,
    grants.some(
      (s) => s.coaching?.dataAccess.workouts || s.coaching?.dataAccess.sleep,
    )
      ? tx.healthIntegration.aggregate({
          where: { userId: user.id },
          _max: { updatedAt: true },
          _count: true,
        })
      : null,
  ]);
  return {
    healthVersion: { workoutVersion, sleepVersion, syncVersion },
    now,
    entitled: account.planType !== "FREE" && !account.deletedAt,
    supports: state.supports,
    state: state.monitoring,
    plans: plans.map((p) => ({
      ...p,
      activityIds: p.activities.map((a) => a.id),
    })),
    entries,
    messages,
    sessions: Object.values(state.sessions),
    legacyLastOutreachAt: Object.values(state.checks)
      .flatMap((c) =>
        c.sentAt || c.claimedAt ? [c.sentAt || c.claimedAt!] : [],
      )
      .sort()
      .at(-1),
  };
}
function fingerprint(input: Awaited<ReturnType<typeof readInput>>) {
  return fingerprintValue({
    healthVersion: input.healthVersion,
    entitled: input.entitled,
    outreachPaused: input.state.outreachPaused,
    pausedPlanIds: input.state.pausedPlanIds,
    setupPlanIds: input.state.setupPlanIds,
    lapsePlanIds: input.state.lapsePlanIds,
    supports: input.supports,
    plans: [...input.plans].sort((a, b) => a.id.localeCompare(b.id)),
    entries: input.entries,
    sessions: [...input.sessions].sort((a, b) => a.id.localeCompare(b.id)),
    legacyLastOutreachAt: input.legacyLastOutreachAt,
    messages: input.messages.map((m) => [m.id, m.content, m.metadata]),
  });
}
export async function monitorUser(user: User, now = new Date()) {
  let initial: Awaited<ReturnType<typeof readInput>>;
  let signature = "";
  const leaseId = randomUUID();
  return runMonitoring({
    claim: () =>
      changeState(user.id, async (state, tx) => {
        initial = await readInput(tx, user, state, now);
        const decision = decideMonitoring(initial);
        if (!decision) return null;
        signature = fingerprint(initial);
        initial.state.lease = {
          id: leaseId,
          until: new Date(now.getTime() + 10 * 60000).toISOString(),
        };
        return decision;
      }),
    generate: async (decision) => {
      if (decision.kind === "reminder") return { draftMessages: [] };
      const active = initial.plans.filter((p) =>
        decision.planIds.includes(p.id),
      );
      if (decision.kind === "session")
        return {
          draftMessages: [
            {
              content: `Did your planned session for “${active[0].goal}” happen? There is no matching log yet. You can log it, tell me it changed, or leave it unconfirmed.`,
              requiresReply: true,
            },
          ],
        };
      return scheduledCoachGeneration.generate({
        user,
        now,
        decision,
        plans: active,
        supports: initial.supports,
        entries: initial.entries,
        conversationHistory: toCoachConversationHistory(
          [...initial.messages].reverse().slice(-30),
        ),
        assumedMissedSessionIds: initial.sessions
          .filter((s) => s.assumedMissed && s.id.startsWith("existing:"))
          .map((s) => s.id.slice("existing:".length)),
      });
    },
    commit: async (decision, result) => {
      const delivery = await changeState(user.id, async (state, tx) => {
        const fresh = await readInput(tx, user, state, now);
        if (
          fresh.state.lease?.id !== leaseId ||
          fingerprint(fresh) !== signature
        )
          return null;
        const m = fresh.state;
        if (decision.kind === "reminder") {
          const request = m.requests.find(
            (r) => r.id === decision.requestId && !r.resolvedAt && !r.closedAt,
          );
          if (!request?.chatId || !request.messageId || request.reminderAt)
            return null;
          request.reminderAt = now.toISOString();
          m.lastOutreachAt = now.toISOString();
          return saveNotification(
            tx,
            user.id,
            decision,
            request.chatId,
            request.messageId,
            now,
            m.viewingUntil,
            "Your coach has one unanswered question. Reply when it suits you; this is the only reminder.",
          );
        }
        if (result.draftMessages.some((d) => d.error))
          throw new Error("Coach generation failed; no review delivered");
        for (const id of decision.planIds)
          if (decision.kind === "review")
            m.reviewed[id] = formatInTimeZone(
              now,
              fresh.supports[id].timezone,
              "yyyy-MM-dd",
            );
        if (decision.kind === "setup" && result.draftMessages.some((d) => d.planProposals?.length))
          m.setupPlanIds = m.setupPlanIds?.filter(
            (id) => !decision.planIds.includes(id),
          );
        if (decision.kind === "lapse")
          m.lapsePlanIds = m.lapsePlanIds?.filter(
            (id) => !decision.planIds.includes(id),
          );
        if (decision.entryId)
          m.consideredEntries[decision.entryId] = fresh.entries
            .find((e) => e.id === decision.entryId)!
            .updatedAt.toISOString();
        if (result.skipped || !result.draftMessages.length) return null;
        // A proactive review can modify only plans in its agreed scope.
        for (const d of result.draftMessages) {
          if (
            d.planCreationProposals?.length ||
            d.activityLogProposals?.length ||
            d.activityEditProposals?.length ||
            d.planProposals?.some((p) => !decision.planIds.includes(p.planId))
          )
            throw new Error("Out-of-scope proactive proposal");
        }
        let chat = await tx.chat.findFirst({
          where: { userId: user.id, type: "COACH" },
          orderBy: { updatedAt: "desc" },
        });
        if (!chat) {
          let coach = await tx.coach.findFirst({
            where: { ownerId: user.id, type: "AI" },
          });
          coach ??= await tx.coach.create({
            data: { ownerId: user.id, type: "AI" },
          });
          chat = await tx.chat.create({
            data: { userId: user.id, type: "COACH", coachId: coach.id },
          });
        }
        let messageId = "";
        const requiresReply = result.draftMessages.some(
          (d) => d.requiresReply || d.planProposals?.length,
        );
        for (const draft of result.draftMessages) {
          const message = await tx.message.create({
            data: {
              chatId: chat.id,
              role: "COACH",
              content: draft.content,
              createdAt: now,
              planId:
                decision.planIds.length === 1 ? decision.planIds[0] : null,
              metadata: JSON.parse(
                JSON.stringify({
                  ...draft,
                  toolCalls: undefined,
                  content: undefined,
                  source: "plan_monitoring",
                  healthDataAccess: result.healthDataAccess,
                  planIds: decision.planIds,
                  coachRequestId: decision.id,
                  requiresReply,
                  planBasis: Object.fromEntries(
                    fresh.plans
                      .filter((p) => decision.planIds.includes(p.id))
                      .map((p) => [p.id, planProposalBasis(p)]),
                  ),
                }),
              ),
            },
          });
          messageId = message.id;
        }
        await tx.chat.update({
          where: { id: chat.id },
          data: { updatedAt: now },
        });
        m.requests.push({
          id: decision.id,
          kind: decision.kind,
          planIds: decision.planIds,
          entryId: decision.entryId,
          sessionId: decision.sessionId,
          createdAt: now.toISOString(),
          requiresReply,
          chatId: chat.id,
          messageId,
        });
        // Retain unresolved work; bound old completed review history.
        m.requests = m.requests.filter(
          (r) =>
            (!r.closedAt && !r.resolvedAt && r.requiresReply) ||
            Date.parse(r.createdAt) > now.getTime() - 90 * 86400000,
        );
        // A nudge is silent: no notification, no push, and it doesn't use up today's contact.
        if (decision.kind === "nudge") return { id: "", url: "", body: "", push: false };
        m.lastOutreachAt = now.toISOString();
        if (decision.kind === "difficulty" || decision.kind === "session")
          m.lastExtraAt = now.toISOString();
        return saveNotification(
          tx,
          user.id,
          decision,
          chat.id,
          messageId,
          now,
          m.viewingUntil,
          requiresReply
            ? "Your coach has a question or change for you to review."
            : "Your coach review is ready.",
        );
      });
      if (!delivery) return false;
      if (delivery.push) {
        const sent = await notificationService.sendPushNotification(
          user.id,
          "Your coach",
          delivery.body,
          delivery.url,
        );
        if (sent.platform !== "none")
          await prisma.notification.update({
            where: { id: delivery.id },
            data: { sentAt: new Date() },
          });
      }
      return true;
    },
    release: () =>
      changeState(user.id, async (state) => {
        if (state.monitoring?.lease?.id === leaseId)
          delete state.monitoring.lease;
      }),
  });
}
/** Finish setup in the background; the durable queue is retried by the hourly scheduler. */
export function startPlanMonitoring(user: User) {
  if (!hasAiConsent(user)) return; // coach check-ins use AI
  void monitorUser(user).catch((error) =>
    logger.error("Plan setup failed", { userId: user.id, error }),
  );
}
async function saveNotification(
  tx: Prisma.TransactionClient,
  userId: string,
  decision: MonitoringDecision,
  chatId: string,
  messageId: string,
  now: Date,
  viewingUntil: string | undefined,
  body: string,
) {
  const id = `coach-${createHash("sha256").update(`${userId}:${decision.id}`).digest("hex").slice(0, 40)}`;
  const url = `/chat/${encodeURIComponent(chatId)}?messageId=${encodeURIComponent(messageId)}${decision.planIds.length === 1 ? `&planId=${encodeURIComponent(decision.planIds[0])}` : ""}`;
  await tx.notification.create({
    data: {
      id,
      userId,
      type: "COACH",
      title: "Your coach",
      message: body,
      status: "PROCESSED",
      processedAt: now,
      relatedId: chatId,
      relatedData: { url, chatId, messageId, planIds: decision.planIds },
    },
  });
  return {
    id,
    url,
    body,
    push: !viewingUntil || Date.parse(viewingUntil) <= now.getTime(),
  };
}
/** "Get back on it tomorrow": one push at the plan's reminder time, unless it was already logged. */
export async function sendDueReminders(user: User, now = new Date()) {
  const due = await changeState(user.id, async (state, tx) => {
    const reminders = state.monitoring?.reminders ?? [];
    const ready = reminders.filter((r) => !r.sentAt && Date.parse(r.dueAt) <= now.getTime());
    if (!ready.length) return [];
    for (const reminder of ready) reminder.sentAt = now.toISOString();
    state.monitoring!.reminders = reminders.filter(
      (r) => !r.sentAt || now.getTime() - Date.parse(r.sentAt) < 30 * 86400000,
    );
    const plans = await tx.plan.findMany({
      where: {
        id: { in: ready.map((r) => r.planId) },
        userId: user.id,
        archivedAt: null,
        deletedAt: null,
      },
      select: { id: true, goal: true, emoji: true, activities: { select: { id: true } } },
    });
    const loggedToday = await tx.activityEntry.findMany({
      where: {
        userId: user.id,
        deletedAt: null,
        datetime: { gte: new Date(now.getTime() - 12 * 3600000) },
        activityId: { in: plans.flatMap((p) => p.activities.map((a) => a.id)) },
      },
      select: { activityId: true },
    });
    return plans.filter(
      (p) => !loggedToday.some((e) => p.activities.some((a) => a.id === e.activityId)),
    );
  });
  for (const plan of due)
    await notificationService
      .sendPushNotification(
        user.id,
        `${plan.emoji ?? ""} ${plan.goal}`.trim(),
        "Today's the day you said you'd get back to it.",
        `/plan/${plan.id}`,
      )
      .catch((error) => logger.warn("Coach reminder push failed", { userId: user.id, error }));
}

export async function deliverPlanMonitoring() {
  const accounts = await prisma.coachingState.findMany({
    where: {
      data: { path: ["enabled"], equals: true },
      user: { deletedAt: null },
    },
    include: { user: true },
  });
  for (const account of accounts) {
    const state = account.data as unknown as FollowThroughState;
    if (!Object.values(state.supports).some((s) => s.coaching)) continue;
    try {
      await sendDueReminders(account.user);
      // AI consent: reminders are plain pushes, coach check-ins use AI.
      if (hasAiConsent(account.user)) await monitorUser(account.user);
    } catch (error) {
      logger.error("Plan monitoring failed", { userId: account.userId, error });
    }
  }
}
