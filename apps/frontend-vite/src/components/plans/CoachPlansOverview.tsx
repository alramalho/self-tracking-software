import { useApiWithAuth } from "@/api";
import { CalendarGrid } from "@/components/CalendarGrid";
import { CoachActionsCard } from "@/components/CoachActionsCard";
import { MessageBubble, MessageMarkdown } from "@/components/MessageBubble";
import { PlanProposalCard } from "@/components/PlanProposalCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useAI } from "@/contexts/ai";
import { useActivities } from "@/contexts/activities/useActivities";
import { getMessages, useMessages, type Message } from "@/contexts/messages";
import { useCurrentUser } from "@/contexts/users";
import { getCoachAvatar, getCoachPersonalityConfig } from "@/lib/coachPersonality";
import { cn } from "@/lib/utils";
import {
  computeGridCells,
  isActiveVisiblePlan,
  type GridData,
} from "@/utils/ghostGrid";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow, isSameDay } from "date-fns";
import { CalendarDays, ChevronDown, Sparkles } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import {
  getPendingCoachPlanProposals,
  type ResolvedCoachPlanProposal,
} from "./coachPlanProposal";
import type { CoachPlansOverviewProps } from "./types";

const LATEST_ASSESSMENT_WINDOW_MS = 10 * 60 * 1000;

function getLatestAssessmentMessages(messages: Message[]): Message[] {
  const assessmentMessages = messages
    .filter(
      (message) =>
        message.role === "COACH" && message.source === "autonomous_coach"
    )
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

  const latest = assessmentMessages.at(-1);
  if (!latest) return [];

  const latestTime = new Date(latest.createdAt).getTime();
  return assessmentMessages.filter(
    (message) =>
      latestTime - new Date(message.createdAt).getTime() <=
      LATEST_ASSESSMENT_WINDOW_MS
  );
}

function CalendarOverview({
  gridData,
  isCompletedOnDay,
}: {
  gridData: GridData;
  isCompletedOnDay: (activityId: string, day: Date) => boolean;
}) {
  const hasGridContent =
    gridData.scheduledSessions.length > 0 || gridData.ghostCells.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <CalendarDays className="h-4 w-4 text-muted-foreground" />
        <span>This week / next week</span>
      </div>
      {hasGridContent ? (
        <CalendarGrid
          sessions={gridData.scheduledSessions}
          activities={gridData.activities}
          ghostCells={gridData.ghostCells}
          isCompletedOnDay={isCompletedOnDay}
          showLegend={false}
          weekLabels={{ week1: "This week", week2: "Next week" }}
          selectedSessionDisplay="card"
          allDaysSelectable
        />
      ) : (
        <div className="rounded-xl border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
          No upcoming sessions.
        </div>
      )}
    </div>
  );
}

function AssessmentMessage({
  message,
  proposals,
  onAcceptProposal,
  onRejectProposal,
}: {
  message: Message;
  proposals: ResolvedCoachPlanProposal[];
  onAcceptProposal: (
    messageId: string,
    proposalIndex: number
  ) => Promise<void>;
  onRejectProposal: (
    messageId: string,
    proposalIndex: number
  ) => Promise<void>;
}) {
  return (
    <div className="space-y-2">
      <MessageBubble
        direction="left"
        timestamp={message.createdAt}
        tailPosition="top"
        className="bg-muted/60"
      >
        <div className="text-sm">
          <MessageMarkdown>{message.content}</MessageMarkdown>
        </div>
      </MessageBubble>

      {message.coachAttentionItems && message.coachAttentionItems.length > 0 ? (
        <CoachActionsCard items={message.coachAttentionItems} />
      ) : null}

      {proposals.map(({ proposal, originalIndex, plan, operations }) => (
        <PlanProposalCard
          key={`${message.id}-${originalIndex}`}
          messageId={message.id}
          proposalIndex={originalIndex}
          planGoal={proposal.planGoal}
          planEmoji={proposal.planEmoji}
          description={proposal.description}
          operations={operations}
          plan={plan}
          status={proposal.status}
          onAccept={onAcceptProposal}
          onReject={onRejectProposal}
        />
      ))}
    </div>
  );
}

export function CoachPlansOverview({ plans }: CoachPlansOverviewProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const api = useApiWithAuth();
  const queryClient = useQueryClient();
  const { currentUser } = useCurrentUser();
  const { activityEntries } = useActivities();
  const { chats, isLoadingChats } = useMessages();
  const { acceptProposal, rejectProposal } = useAI();
  const aiCoach = getCoachPersonalityConfig(currentUser?.coachPersonality);
  const avatar = getCoachAvatar(currentUser?.coachPersonality, "coachSpeaking");

  const activePlans = useMemo(
    () => plans.filter(isActiveVisiblePlan),
    [plans]
  );

  const coachChat = useMemo(
    () =>
      chats
        ?.filter((chat) => chat.type === "COACH")
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )[0] || null,
    [chats]
  );

  const coachMessagesQueryKey = useMemo(
    () => ["coach-plans-overview-messages", coachChat?.id] as const,
    [coachChat?.id]
  );

  const { data: coachMessages = [], isLoading: isLoadingCoachMessages } =
    useQuery({
      queryKey: coachMessagesQueryKey,
      queryFn: () =>
        getMessages(api, coachChat!.id, { includeCoachHistory: true }),
      enabled: !!coachChat?.id,
      staleTime: 1000 * 60,
    });

  const gridData = useMemo<GridData>(
    () => computeGridCells(activePlans, new Date(), activityEntries || []),
    [activePlans, activityEntries]
  );

  const isCompletedOnDay = useCallback(
    (activityId: string, day: Date) =>
      (activityEntries || []).some(
        (entry) =>
          entry.activityId === activityId &&
          isSameDay(new Date(entry.datetime), day)
      ),
    [activityEntries]
  );

  const latestAssessmentMessages = useMemo(
    () => getLatestAssessmentMessages(coachMessages),
    [coachMessages]
  );

  const proposalsByMessageId = useMemo(() => {
    const grouped = new Map<string, ResolvedCoachPlanProposal[]>();

    for (const message of latestAssessmentMessages) {
      grouped.set(
        message.id,
        getPendingCoachPlanProposals(message, activePlans)
      );
    }

    return grouped;
  }, [activePlans, latestAssessmentMessages]);

  const latestAssessmentDate = latestAssessmentMessages.at(-1)?.createdAt;
  const isLoadingAssessment = isLoadingChats || isLoadingCoachMessages;

  const refreshCoachOverview = async () => {
    await queryClient.invalidateQueries({ queryKey: coachMessagesQueryKey });
  };

  const handleAcceptProposal = async (
    messageId: string,
    proposalIndex: number
  ) => {
    await acceptProposal({ messageId, proposalIndex });
    await refreshCoachOverview();
  };

  const handleRejectProposal = async (
    messageId: string,
    proposalIndex: number
  ) => {
    await rejectProposal({ messageId, proposalIndex });
    await refreshCoachOverview();
  };

  if (activePlans.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-border bg-card/70 p-4 shadow-sm">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 text-left"
        onClick={() => setIsExpanded((value) => !value)}
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">
            Coach overview
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-0.5">
          {latestAssessmentDate ? (
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(latestAssessmentDate), {
                addSuffix: true,
              })}
            </span>
          ) : null}
          <ChevronDown
            className={cn(
              "h-5 w-5 text-muted-foreground transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
              isExpanded && "rotate-180"
            )}
          />
        </div>
      </button>

      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity,margin-top] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          isExpanded
            ? "mt-4 grid-rows-[1fr] opacity-100"
            : "mt-0 grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="space-y-5">
            <div>
              <div className="mb-3 flex items-center gap-1.5 text-[11px] font-medium text-primary">
                <Sparkles size={12} />
                <span>{aiCoach.name} assessment</span>
              </div>

              {isLoadingAssessment ? (
                <div className="flex items-start gap-3">
                  <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-16 w-full rounded-3xl" />
                    <Skeleton className="h-12 w-5/6 rounded-3xl" />
                  </div>
                </div>
              ) : latestAssessmentMessages.length > 0 ? (
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
                    {latestAssessmentMessages.map((message) => (
                      <AssessmentMessage
                        key={message.id}
                        message={message}
                        proposals={proposalsByMessageId.get(message.id) || []}
                        onAcceptProposal={handleAcceptProposal}
                        onRejectProposal={handleRejectProposal}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div
                  className={cn(
                    "rounded-xl border border-dashed border-border px-3 py-4",
                    "text-sm text-muted-foreground"
                  )}
                >
                  No coach assessment yet.
                </div>
              )}
            </div>

            <div className="border-t border-border pt-4">
              <CalendarOverview
                gridData={gridData}
                isCompletedOnDay={isCompletedOnDay}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
