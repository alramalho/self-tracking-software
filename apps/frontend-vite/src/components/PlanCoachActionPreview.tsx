import { useApiWithAuth } from "@/api";
import { useAI } from "@/contexts/ai";
import { type Message } from "@/contexts/messages";
import { type CompletePlan } from "@/contexts/plans";
import { getPlanCoachActionMessages } from "@/contexts/plans/service";
import { useCurrentUser } from "@/contexts/users";
import { getCoachAvatar, getCoachPersonalityConfig } from "@/lib/coachPersonality";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import {
  PlanProposalCard,
  type ResolvedOperation,
} from "./PlanProposalCard";

type PlanCoachActionPreviewProps = {
  selectedPlan: CompletePlan;
  className?: string;
};

function hasProposalChanges(proposal: any): boolean {
  const patch = proposal?.patch;
  return !!(
    proposal?.operations?.length ||
    patch?.archive ||
    patch?.plan ||
    patch?.sessions?.upsert?.length ||
    patch?.sessions?.deleteIds?.length ||
    patch?.milestones?.upsert?.length ||
    patch?.milestones?.deleteIds?.length
  );
}

function resolveLegacyOperation(
  op: any,
  plan: CompletePlan
): ResolvedOperation {
  if (op.type === "archive") {
    return { type: "archive" };
  }

  if (op.type === "update_plan") {
    return {
      type: "update_plan",
      goal: op.goal,
      goalReason: op.goalReason,
      timesPerWeek: op.timesPerWeek,
    };
  }

  const activity = plan.activities?.find((item) => item.id === op.activityId);
  return {
    date: op.date,
    type: op.type,
    quantity: op.quantity,
    activityName: activity?.title || "Activity",
    activityEmoji: activity?.emoji || "📋",
    activityMeasure: activity?.measure || "",
    descriptiveGuide: op.descriptiveGuide,
  };
}

function toDateString(value: Date | string | null | undefined) {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : value;
}

function resolvePatchOperations(
  patch: any,
  plan: CompletePlan
): ResolvedOperation[] {
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
      timesPerWeek: patch.plan.timesPerWeek,
    });
  }

  for (const session of patch.sessions?.upsert || []) {
    const existing = plan.sessions?.find((item) => item.id === session.id);
    const activityId = session.activityId || existing?.activityId;
    const activity = plan.activities?.find((item) => item.id === activityId);
    resolved.push({
      type: session.id ? "update_session" : "add_session",
      date: toDateString(session.date || existing?.date),
      quantity: session.quantity || existing?.quantity,
      activityName: activity?.title || "Activity",
      activityEmoji: activity?.emoji || "📋",
      activityMeasure: activity?.measure || "",
      descriptiveGuide: session.descriptiveGuide,
    });
  }

  for (const sessionId of patch.sessions?.deleteIds || []) {
    const existing = plan.sessions?.find((item) => item.id === sessionId);
    const activity = plan.activities?.find(
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
    const existing = plan.milestones?.find((item) => item.id === milestone.id);
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
    const existing = plan.milestones?.find((item) => item.id === milestoneId);
    resolved.push({
      type: "delete_milestone",
      milestoneDescription: existing?.description || "Milestone",
      milestoneDate: toDateString(existing?.date),
      milestoneProgress: existing?.progress,
    });
  }

  return resolved;
}

function getPendingPlanProposals(message: Message, planId: string) {
  return (
    message.planProposals
      ?.map((proposal, originalIndex) => ({ proposal, originalIndex }))
      .filter(
        ({ proposal }) =>
          proposal.planId === planId &&
          !proposal.status &&
          hasProposalChanges(proposal)
      ) || []
  );
}

export function PlanCoachActionPreview({
  selectedPlan,
  className,
}: PlanCoachActionPreviewProps) {
  const api = useApiWithAuth();
  const queryClient = useQueryClient();
  const { currentUser } = useCurrentUser();
  const { acceptProposal, rejectProposal } = useAI();
  const aiCoach = getCoachPersonalityConfig(currentUser?.coachPersonality);
  const avatar = getCoachAvatar(currentUser?.coachPersonality, "coachSpeaking");

  const { data: messages = [] } = useQuery({
    queryKey: ["plan-coach-action-messages", selectedPlan.id],
    queryFn: () => getPlanCoachActionMessages(api, selectedPlan.id),
    enabled: !!selectedPlan.id,
    staleTime: 1000 * 60,
  });

  const messagesWithActions = messages.filter(
    (message) => getPendingPlanProposals(message, selectedPlan.id).length > 0
  );

  if (messages.length === 0 || messagesWithActions.length === 0) {
    return null;
  }

  const refresh = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["plan-coach-action-messages", selectedPlan.id],
    });
  };

  const handleAcceptProposal = async (
    messageId: string,
    proposalIndex: number
  ) => {
    await acceptProposal({ messageId, proposalIndex });
    await refresh();
  };

  const handleRejectProposal = async (
    messageId: string,
    proposalIndex: number
  ) => {
    await rejectProposal({ messageId, proposalIndex });
    await refresh();
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-1.5 pl-[3.75rem] text-[11px] font-medium text-primary">
        <Sparkles size={12} />
        <span>{aiCoach.name} has a plan action</span>
      </div>

      <div className="flex items-start gap-3">
        <div className="relative mt-1 h-12 w-12 shrink-0">
          <div className="absolute inset-0 rounded-full bg-primary/10" />
          <img
            src={avatar}
            alt={aiCoach.label}
            className="relative z-10 h-12 w-12 object-contain"
          />
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          {messages.map((message) => {
            const pendingProposals = getPendingPlanProposals(
              message,
              selectedPlan.id
            );

            return (
              <div key={message.id} className="space-y-2">
                <MessageBubble
                  direction="left"
                  timestamp={message.createdAt}
                  tailPosition="top"
                  className="bg-muted/60"
                >
                  <div className="text-sm whitespace-pre-wrap">
                    {message.content}
                  </div>
                </MessageBubble>

                {pendingProposals.map(({ proposal, originalIndex }) => {
                  const operations = proposal.patch
                    ? resolvePatchOperations(proposal.patch, selectedPlan)
                    : (proposal.operations || []).map((operation) =>
                        resolveLegacyOperation(operation, selectedPlan)
                      );

                  return (
                    <PlanProposalCard
                      key={`${message.id}-${originalIndex}`}
                      messageId={message.id}
                      proposalIndex={originalIndex}
                      planGoal={proposal.planGoal}
                      planEmoji={proposal.planEmoji}
                      description={proposal.description}
                      operations={operations}
                      status={proposal.status}
                      onAccept={handleAcceptProposal}
                      onReject={handleRejectProposal}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
