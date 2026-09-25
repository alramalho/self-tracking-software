import type { ActiveCoachPlan, CoachDraftMessage } from "../../types";
import {
  PlanProposalPatchSchema,
  type PlanProposalPatch,
} from "../../../planProposalPatchService";
import type { FollowUpOutput, LapseOutput, SetupOutput } from "./schema";

function proposal(
  plan: ActiveCoachPlan,
  description: string,
  patch: PlanProposalPatch,
) {
  return {
    planId: plan.id,
    planGoal: plan.goal,
    planEmoji: plan.emoji,
    description,
    patch: PlanProposalPatchSchema.parse(patch),
    status: null,
  };
}

function assertSessionActivity(plan: ActiveCoachPlan, activityId: string) {
  if (!plan.activities.some((activity) => activity.id === activityId))
    throw new Error(`Session activity is outside plan ${plan.id}`);
}

function assertSessionDate(date: string) {
  const parsed = new Date(`${date}T12:00:00Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  )
    throw new Error(`Invalid session date ${date}`);
}

export function setupMessage(
  plan: ActiveCoachPlan,
  output: SetupOutput,
): CoachDraftMessage {
  const known = new Set(plan.activities.map((a) => a.title.toLowerCase()));
  const track = output.alsoTrack
    .filter((t) => !known.has(t.title.toLowerCase()))
    // Models sometimes write "weight_1" for an emoji; fall back to a ruler.
    .map((t) => ({ ...t, emoji: /\p{Extended_Pictographic}/u.test(t.emoji) ? t.emoji : "📏" }));
  // A question instead of sessions can still carry the "also track weight" offer.
  if (!output.sessions.length)
    return {
      content: output.message,
      requiresReply: true,
      ...(track.length
        ? { planProposals: [proposal(plan, "Start tracking", { track })] }
        : {}),
    };
  for (const session of output.sessions) {
    assertSessionActivity(plan, session.activityId);
    assertSessionDate(session.date);
  }
  const patch = PlanProposalPatchSchema.parse({
    plan: { outlineType: "SPECIFIC" },
    sessions: { upsert: output.sessions },
    ...(track.length ? { track } : {}),
  });
  return {
    content: output.message,
    requiresReply: output.requiresReply,
    planProposals: [proposal(plan, "Review your first week", patch)],
  };
}

export function followUpMessage(
  plans: ActiveCoachPlan[],
  output: FollowUpOutput,
): CoachDraftMessage | null {
  if (
    output.message === null &&
    (output.modifications.length ||
      output.archives.length ||
      output.requiresReply)
  )
    throw new Error("A plan change or question needs a message");
  if (output.message === null) return null;
  const seen = new Set<string>();
  const modifications = output.modifications.map((change) => {
    const plan = plans.find((item) => item.id === change.planId);
    if (!plan || seen.has(change.planId))
      throw new Error(
        "Follow-up addressed an unavailable plan twice or an unrelated plan",
      );
    seen.add(change.planId);
    const hasChanges =
      change.timesPerWeek !== null ||
      change.newSessions.length > 0 ||
      change.revisedSessions.length > 0 ||
      change.removeSessionIds.length > 0;
    if (!hasChanges) throw new Error("Empty follow-up plan change");
    for (const session of [...change.newSessions, ...change.revisedSessions]) {
      assertSessionActivity(plan, session.activityId);
      assertSessionDate(session.date);
    }
    for (const session of change.revisedSessions)
      if (!plan.sessions.some((existing) => existing.id === session.id))
        throw new Error("Session to revise is outside plan");
    for (const id of change.removeSessionIds)
      if (!plan.sessions.some((existing) => existing.id === id))
        throw new Error("Session to remove is outside plan");
    const needsSpecific =
      change.newSessions.length > 0 && plan.outlineType !== "SPECIFIC";
    const patch: PlanProposalPatch = {
      ...(change.timesPerWeek !== null || needsSpecific
        ? {
            plan: {
              ...(change.timesPerWeek !== null
                ? { timesPerWeek: change.timesPerWeek }
                : {}),
              ...(needsSpecific ? { outlineType: "SPECIFIC" as const } : {}),
            },
          }
        : {}),
      ...(change.newSessions.length ||
      change.revisedSessions.length ||
      change.removeSessionIds.length
        ? {
            sessions: {
              ...([...change.newSessions, ...change.revisedSessions].length
                ? { upsert: [...change.newSessions, ...change.revisedSessions] }
                : {}),
              ...(change.removeSessionIds.length
                ? { deleteIds: change.removeSessionIds }
                : {}),
            },
          }
        : {}),
    };
    return proposal(plan, change.description, patch);
  });
  const archives = output.archives.map((change) => {
    const plan = plans.find((item) => item.id === change.planId);
    if (!plan || seen.has(change.planId))
      throw new Error(
        "Follow-up addressed an unavailable plan twice or an unrelated plan",
      );
    seen.add(change.planId);
    return proposal(plan, change.description, { archive: true });
  });
  const planProposals = [...modifications, ...archives];
  return {
    content: output.message,
    requiresReply: output.requiresReply,
    ...(planProposals.length ? { planProposals } : {}),
  };
}

/** The coach writes the words; the archive offer is always attached, and always needs approval. */
export function lapseMessage(
  plans: ActiveCoachPlan[],
  output: LapseOutput,
): CoachDraftMessage {
  return {
    content: output.message,
    requiresReply: true,
    planProposals: plans.map((plan) =>
      proposal(plan, `Archive “${plan.goal}”`, { archive: true }),
    ),
  };
}

/** The coach writes the words; the two choices (remind tomorrow / let it go) are app buttons. */
export function nudgeMessage(plan: ActiveCoachPlan, output: LapseOutput): CoachDraftMessage {
  return { content: output.message, requiresReply: true, nudge: { planId: plan.id } };
}
