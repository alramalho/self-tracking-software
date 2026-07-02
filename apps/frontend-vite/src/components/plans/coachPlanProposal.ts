import type { ResolvedOperation } from "@/components/PlanProposalCard";
import type { Message } from "@/contexts/messages";
import type { CompletePlan } from "@/contexts/plans";

export type CoachPlanProposal = NonNullable<Message["planProposals"]>[number];

export type ResolvedCoachPlanProposal = {
  message: Message;
  proposal: CoachPlanProposal;
  originalIndex: number;
  plan: CompletePlan | null;
  operations: ResolvedOperation[];
};

export function hasCoachPlanProposalChanges(proposal: unknown): boolean {
  const data = proposal as any;
  const patch = data?.patch;

  return !!(
    data?.operations?.length ||
    patch?.archive ||
    patch?.plan ||
    patch?.sessions?.upsert?.length ||
    patch?.sessions?.deleteIds?.length ||
    patch?.milestones?.upsert?.length ||
    patch?.milestones?.deleteIds?.length
  );
}

function toDateString(value: Date | string | null | undefined) {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : value;
}

export function resolveLegacyCoachPlanOperation(
  operation: unknown,
  plan?: CompletePlan | null
): ResolvedOperation {
  const op = operation as any;

  if (op.type === "archive") {
    return { type: "archive" };
  }

  if (op.type === "update_plan") {
    return {
      type: "update_plan",
      goal: op.goal,
      goalReason: op.goalReason,
      notes: op.notes,
      finishingDate: op.finishingDate,
      outlineType: op.outlineType,
      timesPerWeek: op.timesPerWeek,
    };
  }

  const activity = plan?.activities?.find((item) => item.id === op.activityId);
  return {
    date: op.date,
    type: op.type,
    quantity: op.quantity,
    activityName: activity?.title || op.activityName || "Activity",
    activityEmoji: activity?.emoji || op.activityEmoji || "📋",
    activityMeasure: activity?.measure || op.activityMeasure || "",
    descriptiveGuide: op.descriptiveGuide,
  };
}

export function resolveCoachPlanPatchOperations(
  patchValue: unknown,
  plan?: CompletePlan | null
): ResolvedOperation[] {
  const patch = patchValue as any;
  const resolved: ResolvedOperation[] = [];

  if (!patch) return resolved;

  if (patch.archive) {
    resolved.push({ type: "archive" });
  }

  if (patch.plan) {
    resolved.push({
      type: "update_plan",
      goal: patch.plan.goal,
      goalReason: patch.plan.goalReason,
      notes: patch.plan.notes,
      finishingDate: patch.plan.finishingDate,
      outlineType: patch.plan.outlineType,
      timesPerWeek: patch.plan.timesPerWeek,
    });
  }

  for (const session of patch.sessions?.upsert || []) {
    const existing = plan?.sessions?.find((item) => item.id === session.id);
    const activityId = session.activityId || existing?.activityId;
    const activity = plan?.activities?.find((item) => item.id === activityId);

    resolved.push({
      type: session.id ? "update_session" : "add_session",
      date: toDateString(session.date || existing?.date),
      quantity: session.quantity ?? existing?.quantity,
      activityName: activity?.title || session.activityName || "Activity",
      activityEmoji: activity?.emoji || session.activityEmoji || "📋",
      activityMeasure: activity?.measure || session.activityMeasure || "",
      descriptiveGuide: session.descriptiveGuide,
    });
  }

  for (const sessionId of patch.sessions?.deleteIds || []) {
    const existing = plan?.sessions?.find((item) => item.id === sessionId);
    const activity = plan?.activities?.find(
      (item) => item.id === existing?.activityId
    );

    resolved.push({
      type: "delete_session",
      date: toDateString(existing?.date),
      quantity: existing?.quantity,
      activityName: activity?.title || "Session",
      activityEmoji: activity?.emoji || "📋",
      activityMeasure: activity?.measure || "",
    });
  }

  for (const milestone of patch.milestones?.upsert || []) {
    const existing = plan?.milestones?.find((item) => item.id === milestone.id);

    resolved.push({
      type: milestone.id ? "update_milestone" : "add_milestone",
      milestoneDescription:
        milestone.description || existing?.description || "Milestone",
      milestoneDate: toDateString(milestone.date || existing?.date),
      milestoneProgress: milestone.progress ?? existing?.progress,
      milestoneCriteria: milestone.criteria ?? existing?.criteria,
    });
  }

  for (const milestoneId of patch.milestones?.deleteIds || []) {
    const existing = plan?.milestones?.find((item) => item.id === milestoneId);

    resolved.push({
      type: "delete_milestone",
      milestoneDescription: existing?.description || "Milestone",
      milestoneDate: toDateString(existing?.date),
      milestoneProgress: existing?.progress,
    });
  }

  return resolved;
}

export function resolveCoachPlanProposal(
  message: Message,
  proposal: CoachPlanProposal,
  originalIndex: number,
  plans: CompletePlan[]
): ResolvedCoachPlanProposal | null {
  if (proposal.status || !hasCoachPlanProposalChanges(proposal)) {
    return null;
  }

  const plan = plans.find((item) => item.id === proposal.planId) || null;
  const operations = proposal.patch
    ? resolveCoachPlanPatchOperations(proposal.patch, plan)
    : (proposal.operations || []).map((operation) =>
        resolveLegacyCoachPlanOperation(operation, plan)
      );

  return {
    message,
    proposal,
    originalIndex,
    plan,
    operations,
  };
}

export function getPendingCoachPlanProposals(
  message: Message,
  plans: CompletePlan[]
): ResolvedCoachPlanProposal[] {
  return (
    message.planProposals
      ?.map((proposal, originalIndex) =>
        resolveCoachPlanProposal(message, proposal, originalIndex, plans)
      )
      .filter((item): item is ResolvedCoachPlanProposal => Boolean(item)) || []
  );
}

export function getPendingCoachPlanProposalsForPlan(
  message: Message,
  plan: CompletePlan
): ResolvedCoachPlanProposal[] {
  return getPendingCoachPlanProposals(message, [plan]).filter(
    (item) => item.proposal.planId === plan.id
  );
}
