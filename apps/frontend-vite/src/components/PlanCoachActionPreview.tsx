import { useApiWithAuth } from "@/api";
import { useAI } from "@/contexts/ai";
import { type CompletePlan } from "@/contexts/plans";
import { getPlanCoachActionMessages } from "@/contexts/plans/service";
import { useCurrentUser } from "@/contexts/users";
import { getCoachAvatar, getCoachPersonalityConfig } from "@/lib/coachPersonality";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import { PlanProposalCard } from "./PlanProposalCard";
import { getPendingCoachPlanProposalsForPlan } from "./plans/coachPlanProposal";

type PlanCoachActionPreviewProps = {
  selectedPlan: CompletePlan;
  className?: string;
};

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
    (message) =>
      getPendingCoachPlanProposalsForPlan(message, selectedPlan).length > 0
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
            const pendingProposals = getPendingCoachPlanProposalsForPlan(
              message,
              selectedPlan
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

                {pendingProposals.map(({ proposal, originalIndex, operations }) => (
                  <PlanProposalCard
                    key={`${message.id}-${originalIndex}`}
                    messageId={message.id}
                    proposalIndex={originalIndex}
                    planGoal={proposal.planGoal}
                    planEmoji={proposal.planEmoji}
                    description={proposal.description}
                    operations={operations}
                    plan={selectedPlan}
                    status={proposal.status}
                    onAccept={handleAcceptProposal}
                    onReject={handleRejectProposal}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
