import { CoachToolCallsCard } from "@/components/CoachToolCallsCard";
import { MessageBubble, MessageMarkdown } from "@/components/MessageBubble";
import { MessageFeedback } from "@/components/MessageFeedback";
import { MessageImageAttachments } from "@/components/MessageImageAttachments";
import { MetricSuggestion } from "@/components/MetricSuggestion";
import { PlanLink } from "@/components/PlanLink";
import { ActivityLink } from "@/components/ActivityLink";
import { UserActionCard } from "@/components/UserActionCard";
import { CalendarGrid } from "@/components/CalendarGrid";
import { ChatMessageComposer } from "@/components/ChatMessageComposer";
import ImageZoomDialog from "@/components/ImageZoomDialog";
import AppleLikePopover from "@/components/AppleLikePopover";
import {
  CoachAttentionDrawer,
  useCoachAttentionItems,
} from "@/components/CoachAttentionBanner";
import {
  computeGridCells,
  isActiveVisiblePlan,
  type GridData,
} from "@/utils/ghostGrid";
import { AnimatePresence, motion } from "framer-motion";
import { ActivityLogProposalCard } from "@/components/ActivityLogProposalCard";
import { ActivityEditProposalCard } from "@/components/ActivityEditProposalCard";
import { UserContextEventProposalCard } from "@/components/UserContextEventProposalCard";
import { PlanCreationProposalCard } from "@/components/PlanCreationProposalCard";
import { PlanProposalCard } from "@/components/PlanProposalCard";
import { UserRecommendationCards } from "@/components/UserRecommendationCards";
import { Button } from "@/components/ui/button";
import { useAI } from "@/contexts/ai";
import { useCurrentUser } from "@/contexts/users";
import { useMessages, type ImageAttachment, type Message } from "@/contexts/messages";
import { usePlans } from "@/contexts/plans";
import { useActivities } from "@/contexts/activities/useActivities";
import type { ResolvedOperation } from "@/components/PlanProposalCard";
import { useSessionMessage } from "@/contexts/session-message";
import { useThemeColors } from "@/hooks/useThemeColors";
import { useClipboard } from "@/hooks/useClipboard";
import { getThemeVariants } from "@/utils/theme";
import { toDisplayErrorMessage } from "@/utils/errorMessage";
import { cn } from "@/lib/utils";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, ArrowLeft, X, Settings, AlertCircle, AlertTriangle, EllipsisVertical, MessageSquarePlus, Eraser, Sparkles, ChevronDown, Eye, CalendarDays, Pencil, Copy, Check } from "lucide-react";
import { differenceInCalendarDays, format } from "date-fns";
import { useState, useEffect, useMemo, useCallback, useRef, useLayoutEffect } from "react";
import { useInView } from "react-intersection-observer";
import { toast } from "react-hot-toast";
import { useNavigate } from "@tanstack/react-router";
import ConfirmDialogOrPopover from "@/components/ConfirmDialogOrPopover";
import { getCoachPersonalityConfig } from "@/lib/coachPersonality";

// Helper to format relative dates for dividers
function formatRelativeDate(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((today.getTime() - messageDate.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";

  return format(messageDate, "d MMM yyyy");
}

// Helper to check if two dates are on the same day
function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

// Date divider component
function DateDivider({ date }: { date: Date }) {
  return (
    <div className="relative -mx-4 flex items-center py-3">
      <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-border" />
      <span className="relative mx-auto inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-muted-foreground shadow-sm">
        {formatRelativeDate(date)}
        <ChevronDown size={12} />
      </span>
    </div>
  );
}

function AssessmentDivider({ position }: { position: "start" | "end" }) {
  return (
    <div className="relative -mx-4 flex items-center py-3">
      <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-border/70" />
      <span className="relative mx-auto inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-[11px] font-semibold text-muted-foreground shadow-sm">
        <Sparkles size={12} />
        {position === "start" ? "Coach assessment" : "End assessment"}
      </span>
    </div>
  );
}

function formatCoachVisibleDate(date: Date): string {
  const today = new Date();
  const diffDays = differenceInCalendarDays(today, date);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays > 1 && diffDays <= 6) {
    return `${format(date, "EEE")}, ${diffDays} days ago`;
  }
  if (date.getFullYear() === today.getFullYear()) {
    return format(date, "d MMM");
  }
  return format(date, "d MMMM yyyy");
}

function hasProposalChanges(proposal: any): boolean {
  const patch = proposal.patch;
  return !!(
    proposal.operations?.length ||
    patch?.archive ||
    patch?.plan ||
    patch?.sessions?.upsert?.length ||
    patch?.sessions?.deleteIds?.length ||
    patch?.milestones?.upsert?.length ||
    patch?.milestones?.deleteIds?.length
  );
}

function resolveLegacyOperation(op: any, plan: any, activities: any[] = []): ResolvedOperation {
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

  const activity = plan?.activities?.find((a: any) => a.id === op.activityId)
    || activities?.find((a: any) => a.id === op.activityId);
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

function resolvePatchOperations(patch: any, plan: any, activities: any[] = []): ResolvedOperation[] {
  const resolved: ResolvedOperation[] = [];

  if (!patch) return resolved;
  if (patch.archive) resolved.push({ type: "archive" });
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
    const existing = plan?.sessions?.find((item: any) => item.id === session.id);
    const activityId = session.activityId || existing?.activityId;
    const activity = plan?.activities?.find((a: any) => a.id === activityId)
      || activities?.find((a: any) => a.id === activityId);
    resolved.push({
      type: session.id ? "update_session" : "add_session",
      date: session.date || existing?.date,
      quantity: session.quantity || existing?.quantity,
      activityName: activity?.title || "Activity",
      activityEmoji: activity?.emoji || "📋",
      activityMeasure: activity?.measure || "",
      descriptiveGuide: session.descriptiveGuide,
    });
  }

  for (const sessionId of patch.sessions?.deleteIds || []) {
    const existing = plan?.sessions?.find((item: any) => item.id === sessionId);
    const activity = plan?.activities?.find((a: any) => a.id === existing?.activityId)
      || activities?.find((a: any) => a.id === existing?.activityId);
    resolved.push({
      type: "delete_session",
      date: existing?.date,
      quantity: existing?.quantity,
      activityName: activity?.title || "Session",
      activityEmoji: activity?.emoji || "📋",
      activityMeasure: activity?.measure || "",
    });
  }

  for (const milestone of patch.milestones?.upsert || []) {
    const existing = plan?.milestones?.find((item: any) => item.id === milestone.id);
    resolved.push({
      type: milestone.id ? "update_milestone" : "add_milestone",
      milestoneDescription: milestone.description || existing?.description || "Milestone",
      milestoneDate: milestone.date || existing?.date,
      milestoneProgress: milestone.progress ?? existing?.progress,
      milestoneCriteria: milestone.criteria ?? existing?.criteria,
    });
  }

  for (const milestoneId of patch.milestones?.deleteIds || []) {
    const existing = plan?.milestones?.find((item: any) => item.id === milestoneId);
    resolved.push({
      type: "delete_milestone",
      milestoneDescription: existing?.description || "Milestone",
      milestoneDate: existing?.date,
      milestoneProgress: existing?.progress,
    });
  }

  return resolved;
}

function sanitizePlanDisplayText(text: string, emoji?: string | null): string {
  let cleaned = text.trim();
  while (emoji && cleaned.startsWith(emoji)) {
    cleaned = cleaned.slice(emoji.length).trimStart();
  }
  return cleaned || text.trim();
}

type CitationSource = {
  citationLabel: string;
  displayCitationLabel: string;
  title?: string;
  url: string;
};

function getCitationSources(content: string, toolCalls?: any[] | null): CitationSource[] {
  const citedLabelsInOrder = Array.from(content.matchAll(/\[(\d+)\]/g)).map(
    (match) => `[${match[1]}]`
  );
  if (citedLabelsInOrder.length === 0) return [];

  const citedLabels = new Set(citedLabelsInOrder);
  const displayLabels = new Map<string, string>();
  citedLabelsInOrder.forEach((label) => {
    if (!displayLabels.has(label)) {
      displayLabels.set(label, `[${displayLabels.size + 1}]`);
    }
  });

  const sources: CitationSource[] = [];
  const seenUrls = new Set<string>();
  let fallbackIndex = 1;

  for (const toolCall of toolCalls || []) {
    if (toolCall.tool !== "webSearch" || !toolCall.result?.results) continue;
    for (const result of toolCall.result.results as any[]) {
      if (!result.url || seenUrls.has(result.url)) {
        fallbackIndex += 1;
        continue;
      }
      const citationLabel =
        result.citationLabel ||
        (result.citationIndex ? `[${result.citationIndex}]` : `[${fallbackIndex}]`);
      fallbackIndex += 1;
      if (!citedLabels.has(citationLabel)) continue;
      seenUrls.add(result.url);
      sources.push({
        citationLabel,
        displayCitationLabel: displayLabels.get(citationLabel) || citationLabel,
        title: result.title,
        url: result.url,
      });
    }
  }

  return sources;
}

function CitationPill({ source }: { source: CitationSource }) {
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      title={source.title || source.url}
      className="mx-0.5 inline-flex h-5 min-w-5 translate-y-[-1px] items-center justify-center rounded-full bg-primary/15 px-1.5 text-[10px] font-semibold leading-none text-primary hover:bg-primary/25"
    >
      {source.displayCitationLabel.replace(/^\[|\]$/g, "")}
    </a>
  );
}

type VisibleActivity = {
  id: string;
  emoji: string;
  title: string;
  quantity: number;
  measure: string;
  datetime: Date;
};

function CoachContextContent({
  recentActivities,
  activePlans,
  gridData,
  isCompletedOnDay,
}: {
  recentActivities: VisibleActivity[];
  activePlans: Array<{
    id: string;
    goal: string;
    emoji?: string | null;
  }>;
  gridData: GridData;
  isCompletedOnDay: (activityId: string, day: Date) => boolean;
}) {
  return (
    <div className="max-h-[calc(100dvh-8rem)] space-y-3 overflow-y-auto overscroll-contain px-1 pb-2 pt-1">
                <div>
                  <div className="mb-2 text-xs font-medium text-muted-foreground">
                    Recent logs
                  </div>
                  {recentActivities.length > 0 ? (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {recentActivities.slice(0, 8).map((activity) => (
                        <div
                          key={activity.id}
                          className="min-w-[116px] rounded-xl bg-muted/80 p-2 text-center"
                        >
                          <div className="text-xl leading-none">{activity.emoji}</div>
                          <div className="mt-1 truncate text-sm font-medium text-foreground">
                            {activity.title}
                          </div>
                          <div className="mt-0.5 text-[11px] text-muted-foreground">
                            {formatCoachVisibleDate(activity.datetime)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                      No recent activity logs are available.
                    </div>
                  )}
                </div>

                <div className="rounded-xl bg-muted/60 px-3 py-2">
                  <div className="text-xs font-medium text-muted-foreground">
                    Active plans
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {activePlans.length > 0 ? (
                      activePlans.slice(0, 5).map((plan) => (
                        <PlanLink
                          key={plan.id}
                          planId={plan.id}
                          displayText={plan.goal}
                          emoji={plan.emoji || undefined}
                          className="max-w-full bg-background/70 py-1 text-xs"
                          labelClassName="truncate"
                        />
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        No active plans.
                      </span>
                    )}
                  </div>
                </div>

                <div className="rounded-xl bg-muted/60 px-3 py-2">
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <CalendarDays size={13} />
                    Upcoming sessions
                  </div>
                  {gridData.scheduledSessions.length > 0 ||
                    gridData.ghostCells.length > 0 ? (
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
                    <div className="text-xs text-muted-foreground">
                      No upcoming sessions.
                    </div>
                  )}
                </div>
    </div>
  );
}

function MessageWithReadTracking({
  message,
  isOwnMessage,
  onVisible,
  children,
  className,
  dateLabel,
}: {
  message: { id: string; status?: string };
  isOwnMessage: boolean;
  onVisible: (messageId: string) => void;
  children: React.ReactNode;
  className?: string;
  dateLabel?: string;
}) {
  const { ref, inView } = useInView({
    threshold: 0.5,
    triggerOnce: true,
  });

  useEffect(() => {
    if (inView && !isOwnMessage && message.status === "SENT") {
      onVisible(message.id);
    }
  }, [inView, isOwnMessage, message.id, message.status, onVisible]);

  return (
    <div ref={ref} className={className} data-message-date-label={dateLabel}>
      {children}
    </div>
  );
}

export const Route = createFileRoute("/message-ai")({
  validateSearch: (
    search: Record<string, unknown>
  ): { coachPrompt?: string } => ({
    coachPrompt:
      typeof search.coachPrompt === "string" ? search.coachPrompt : undefined,
  }),
  component: MessageAIPage,
});

function MessageAIPage() {
  const { currentUser } = useCurrentUser();
  const navigate = useNavigate();
  const { coachPrompt } = Route.useSearch();
  const { plans } = usePlans();
  const { activities, activityEntries } = useActivities();
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);
  const [, copyToClipboard] = useClipboard();
  const {
    chats,
    currentChatId,
    setCurrentChatId,
    messages,
    isLoadingMessages,
    sendMessage,
    rewriteMessage,
    isSendingMessage,
    coachResponseStatus,
    isAwaitingCoachResponse,
    coachResponseTimedOut,
    coachResponseErrorMessage,
    isRewritingMessage,
    pendingStaggeredMessages,
    isLoadingChats,
    markMessagesAsRead,
    clearCoachHistory,
    isClearingCoachHistory,
  } = useMessages();
  const hasActiveCoachRequest =
    isSendingMessage || isRewritingMessage || isAwaitingCoachResponse;
  const coachLoadingLabel =
    hasActiveCoachRequest
      ? ({
        thinking: "Thinking...",
        searching: "Searching the web...",
        browsing: "Browsing the web (might take a minute)...",
        drafting: "Drafting...",
      }[coachResponseStatus || "thinking"])
      : pendingStaggeredMessages.length > 0
        ? "Writing..."
        : null;
  const {
    submitFeedback,
    isSubmittingFeedback,
    acceptMetric,
    rejectMetric,
    acceptProposal,
    rejectProposal,
    acceptPlanCreationProposal,
    rejectPlanCreationProposal,
    proposePlanCreationChanges,
    acceptActivityLogProposal,
    rejectActivityLogProposal,
    acceptActivityEditProposal,
    rejectActivityEditProposal,
    acceptUserContextEventProposal,
    rejectUserContextEventProposal,
    createCoachChat,
    isCreatingCoachChat,
    runCoachAssessment,
    isRunningCoachAssessment,
  } = useAI();
  const { pendingSession, clearPendingSession } = useSessionMessage();
  const coachAttentionItems = useCoachAttentionItems();
  const [inputValue, setInputValue] = useState("");
  const [consumedCoachPrompt, setConsumedCoachPrompt] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState<{
    id: string;
    chatId: string;
    content: string;
  } | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [activeActionMessageId, setActiveActionMessageId] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showCoachContext, setShowCoachContext] = useState(false);
  const [showCoachAttentionDrawer, setShowCoachAttentionDrawer] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<{
    src: string;
    alt: string;
  } | null>(null);
  const [activeDateLabel, setActiveDateLabel] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    right: number;
  } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const topChromeRef = useRef<HTMLDivElement>(null);
  const bottomChromeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!coachPrompt || coachPrompt === consumedCoachPrompt) return;

    setInputValue(coachPrompt);
    setConsumedCoachPrompt(coachPrompt);
    navigate({ to: "/message-ai", search: {}, replace: true });
  }, [coachPrompt, consumedCoachPrompt, navigate]);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initiallyScrolledChatIdRef = useRef<string | null>(null);
  const [chromeInsets, setChromeInsets] = useState({ top: 0, bottom: 0 });

  // Debounced mark-as-read tracking
  const messageQueueRef = useRef<Set<string>>(new Set());
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushReadQueue = useCallback(() => {
    if (messageQueueRef.current.size > 0 && currentChatId) {
      const idsToMark = Array.from(messageQueueRef.current);
      markMessagesAsRead(currentChatId, idsToMark);
      messageQueueRef.current.clear();
    }
  }, [currentChatId, markMessagesAsRead]);

  const queueMessageForRead = useCallback(
    (messageId: string) => {
      messageQueueRef.current.add(messageId);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        flushReadQueue();
      }, 2000);
    },
    [flushReadQueue]
  );

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      flushReadQueue();
    };
  }, [flushReadQueue]);

  const aiCoach = getCoachPersonalityConfig(currentUser?.coachPersonality);
  const coachAttentionCount = coachAttentionItems.length;
  const hasCoachAttention = coachAttentionCount > 0;

  useLayoutEffect(() => {
    const updateChromeInsets = () => {
      setChromeInsets({
        top: topChromeRef.current?.offsetHeight ?? 0,
        bottom: bottomChromeRef.current?.offsetHeight ?? 0,
      });
    };

    updateChromeInsets();

    const resizeObserver = new ResizeObserver(updateChromeInsets);
    if (topChromeRef.current) resizeObserver.observe(topChromeRef.current);
    if (bottomChromeRef.current) resizeObserver.observe(bottomChromeRef.current);
    window.addEventListener("resize", updateChromeInsets);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateChromeInsets);
    };
  }, []);

  // Get all coach chats sorted by date (newest first)
  const coachChats = useMemo(() =>
    chats?.filter(c => c.type === "COACH")
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()) || []
    , [chats]);

  const recentActivities = useMemo<VisibleActivity[]>(() => {
    const activitiesById = new Map(
      (activities || []).map((activity: any) => [activity.id, activity])
    );
    return (activityEntries || [])
      .map((entry: any) => {
        const activity = activitiesById.get(entry.activityId);
        if (!activity) return null;
        return {
          id: entry.id,
          emoji: activity.emoji || "📌",
          title: activity.title,
          quantity: entry.quantity,
          measure: activity.measure,
          datetime: new Date(entry.datetime),
        };
      })
      .filter((activity): activity is VisibleActivity => activity !== null)
      .sort((a, b) => b.datetime.getTime() - a.datetime.getTime())
      .slice(0, 12);
  }, [activities, activityEntries]);

  const activePlans = useMemo(
    () =>
      (plans || [])
        .filter(isActiveVisiblePlan)
        .map((plan: any) => ({
          id: plan.id,
          goal: plan.goal,
          emoji: plan.emoji,
        })),
    [plans]
  );

  const gridData = useMemo<GridData>(
    () => computeGridCells(plans, new Date(), activityEntries || []),
    [plans, activityEntries]
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

  // Auto-select most recent coach chat or create one
  useEffect(() => {
    if (isLoadingChats || isClearingCoachHistory) return;

    const currentChatIsCoach =
      !!currentChatId && coachChats.some((chat) => chat.id === currentChatId);

    if (coachChats.length > 0 && !currentChatIsCoach) {
      setCurrentChatId(coachChats[0].id);
    } else if (coachChats.length === 0 && !isCreatingCoachChat) {
      createCoachChat({ title: null });
    }
  }, [coachChats, currentChatId, isLoadingChats, isClearingCoachHistory, isCreatingCoachChat, setCurrentChatId, createCoachChat]);

  // Coach messages include previous coach chats so visible context matches coach memory.
  const allMessages = useMemo(() => {
    return [...(messages || [])].sort((a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [messages]);

  const updateActiveDateLabel = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const messageNodes = Array.from(
      container.querySelectorAll<HTMLElement>("[data-message-date-label]")
    );
    if (messageNodes.length === 0) {
      setActiveDateLabel(null);
      return;
    }

    const containerTop = container.getBoundingClientRect().top;
    const firstVisibleMessage =
      messageNodes.find(
        (node) => node.getBoundingClientRect().bottom > containerTop + 8
      ) || messageNodes[messageNodes.length - 1];

    setActiveDateLabel(firstVisibleMessage.dataset.messageDateLabel || null);
  }, []);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || isLoadingMessages || allMessages.length === 0) {
      setActiveDateLabel(null);
      return;
    }

    updateActiveDateLabel();
    container.addEventListener("scroll", updateActiveDateLabel, {
      passive: true,
    });
    window.addEventListener("resize", updateActiveDateLabel);

    return () => {
      container.removeEventListener("scroll", updateActiveDateLabel);
      window.removeEventListener("resize", updateActiveDateLabel);
    };
  }, [allMessages.length, isLoadingMessages, updateActiveDateLabel]);

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        !menuRef.current?.contains(target) &&
        !menuButtonRef.current?.contains(target)
      ) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showMenu]);

  const updateMenuPosition = useCallback(() => {
    const button = menuButtonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    setMenuPosition({
      top: rect.bottom + 6,
      right: Math.max(12, window.innerWidth - rect.right),
    });
  }, []);

  useEffect(() => {
    if (!showMenu) return;

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [showMenu, updateMenuPosition]);

  const handleClearHistory = async () => {
    try {
      await clearCoachHistory();
      setShowClearDialog(false);
    } catch {
      // Error handled by mutation
    }
  };

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const container = messagesContainerRef.current;

    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior });
      return;
    }

    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  useLayoutEffect(() => {
    if (!currentChatId || isLoadingMessages || allMessages.length === 0) {
      return;
    }

    const isInitialScroll = initiallyScrolledChatIdRef.current !== currentChatId;
    scrollToBottom(isInitialScroll ? "auto" : "smooth");
    initiallyScrolledChatIdRef.current = currentChatId;
  }, [allMessages.length, currentChatId, isLoadingMessages, scrollToBottom]);

  const handleSend = async ({
    message,
    imageAttachments,
  }: {
    message: string;
    imageAttachments: ImageAttachment[];
  }) => {
    if (
      (!message.trim() && imageAttachments.length === 0) ||
      isSendingMessage ||
      isRewritingMessage ||
      !currentChatId
    ) {
      return;
    }

    if (editingMessage) {
      const messageToSend = message.trim();
      const messageId = editingMessage.id;
      const sourceChatId = editingMessage.chatId;
      setEditingMessage(null);
      setTimeout(scrollToBottom, 50);

      try {
        await rewriteMessage({
          chatId: sourceChatId,
          cacheChatId: currentChatId,
          messageId,
          message: messageToSend,
        });
      } catch (error) {
        console.error("Failed to edit message:", error);
        setEditingMessage(editingMessage);
        throw error;
      }
      return;
    }

    let messageToSend = message.trim();
    if (pendingSession) {
      const sessionDate = format(new Date(pendingSession.date), "EEEE, MMM d");
      const description = pendingSession.descriptiveGuide ? `|${pendingSession.descriptiveGuide}` : "";
      const sessionInfo = `[About: ${pendingSession.activityEmoji || "📋"} ${pendingSession.activityTitle} on ${sessionDate}${pendingSession.quantity ? ` (${pendingSession.quantity} ${pendingSession.activityMeasure})` : ""}${description}]\n\n`;
      messageToSend = sessionInfo + messageToSend;
      clearPendingSession();
    }

    setTimeout(scrollToBottom, 50);

    try {
      await sendMessage({
        message: messageToSend,
        chatId: currentChatId,
        coachVersion: "v2",
        imageAttachments,
      });
    } catch (error) {
      console.error("Failed to send message:", error);
      throw error;
    }
  };

  const handleRunCoachAssessment = async () => {
    if (isRunningCoachAssessment) return;

    const toastId = toast.loading("Coach assessment started");

    try {
      const response = await runCoachAssessment();
      toast.success(
        response.result.action === "agent_skipped"
          ? "Coach has nothing to report"
          : "Coach assessment complete",
        { id: toastId }
      );
      setTimeout(scrollToBottom, 100);
    } catch (error) {
      console.error("Failed to run coach assessment:", error);
      toast.error("Failed to run coach assessment", { id: toastId });
    }
  };

  const getMessageCopyText = (message: any) => {
    if (message.userAction) {
      const diffs = message.userAction.diffs || [];
      return [
        message.userAction.title || message.content,
        ...diffs.map(
          (diff: any) => `${diff.label}: ${diff.oldValue} -> ${diff.newValue}`
        ),
        message.userAction.note ? `Note: ${message.userAction.note}` : null,
      ]
        .filter(Boolean)
        .join("\n");
    }

    return typeof message.content === "string" ? message.content : "";
  };

  const handleCopyMessage = async (message: any) => {
    const text = getMessageCopyText(message);
    if (!text) return;

    const copied = await copyToClipboard(text);
    if (copied) {
      setCopiedMessageId(message.id);
      setTimeout(() => {
        setCopiedMessageId((current) => (current === message.id ? null : current));
      }, 1200);
    }
  };

  const toggleCoachMessageActions = (messageId: string) => {
    setActiveActionMessageId((current) =>
      current === messageId ? null : messageId
    );
  };

  const handleAcceptMetric = async (messageId: string, metricId: string, rating: number) => {
    try {
      await acceptMetric({ messageId });
    } catch (error) {
      console.error("Failed to accept metric:", error);
      throw error;
    }
  };

  const handleRejectMetric = async (messageId: string) => {
    try {
      await rejectMetric(messageId);
    } catch (error) {
      console.error("Failed to reject metric:", error);
      throw error;
    }
  };

  const handleAcceptProposal = async (messageId: string, proposalIndex: number) => {
    try {
      await acceptProposal({ messageId, proposalIndex });
    } catch (error) {
      console.error("Failed to accept proposal:", error);
      throw error;
    }
  };

  const handleRejectProposal = async (messageId: string, proposalIndex: number) => {
    try {
      await rejectProposal({ messageId, proposalIndex });
    } catch (error) {
      console.error("Failed to reject proposal:", error);
      throw error;
    }
  };

  const handleAcceptPlanCreationProposal = async (messageId: string, proposalIndex: number) => {
    try {
      await acceptPlanCreationProposal({ messageId, proposalIndex });
    } catch (error) {
      console.error("Failed to accept plan creation proposal:", error);
      throw error;
    }
  };

  const handleRejectPlanCreationProposal = async (messageId: string, proposalIndex: number) => {
    try {
      await rejectPlanCreationProposal({ messageId, proposalIndex });
    } catch (error) {
      console.error("Failed to reject plan creation proposal:", error);
      throw error;
    }
  };

  const handleProposePlanCreationChanges = async (
    messageId: string,
    proposalIndex: number,
    requestedProposal: unknown,
    note?: string | null
  ) => {
    try {
      await proposePlanCreationChanges({
        messageId,
        proposalIndex,
        requestedProposal,
        note: note || null,
      });
      setTimeout(scrollToBottom, 100);
    } catch (error) {
      console.error("Failed to propose plan creation changes:", error);
      throw error;
    }
  };

  const handleAcceptActivityLogProposal = async (messageId: string, proposalIndex: number) => {
    try {
      await acceptActivityLogProposal({ messageId, proposalIndex });
    } catch (error) {
      console.error("Failed to accept activity log proposal:", error);
      throw error;
    }
  };

  const handleRejectActivityLogProposal = async (messageId: string, proposalIndex: number) => {
    try {
      await rejectActivityLogProposal({ messageId, proposalIndex });
    } catch (error) {
      console.error("Failed to reject activity log proposal:", error);
      throw error;
    }
  };

  const handleAcceptActivityEditProposal = async (messageId: string, proposalIndex: number) => {
    try {
      await acceptActivityEditProposal({ messageId, proposalIndex });
    } catch (error) {
      console.error("Failed to accept activity edit proposal:", error);
      throw error;
    }
  };

  const handleRejectActivityEditProposal = async (messageId: string, proposalIndex: number) => {
    try {
      await rejectActivityEditProposal({ messageId, proposalIndex });
    } catch (error) {
      console.error("Failed to reject activity edit proposal:", error);
      throw error;
    }
  };

  const handleAcceptUserContextEventProposal = async (messageId: string, proposalIndex: number) => {
    try {
      await acceptUserContextEventProposal({ messageId, proposalIndex });
    } catch (error) {
      console.error("Failed to accept context event proposal:", error);
      throw error;
    }
  };

  const handleRejectUserContextEventProposal = async (messageId: string, proposalIndex: number) => {
    try {
      await rejectUserContextEventProposal({ messageId, proposalIndex });
    } catch (error) {
      console.error("Failed to reject context event proposal:", error);
      throw error;
    }
  };

  // Session info card component
  const SessionInfoCard = ({ sessionText }: { sessionText: string }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const match = sessionText.match(/\[About: (.+?) (.+?) on ([^(|]+?)(?:\s*\((.+?)\))?(?:\|(.+?))?\]/);
    if (!match) return null;

    const [, emoji, title, date, quantityInfo, description] = match;
    const isLong = description && description.length > 80;
    const isClickable = isLong || description;

    return (
      <div
        className={cn(
          "flex gap-2 pl-3 py-1 mb-2 border-l-2",
          variants.brightBorder,
          isClickable && "cursor-pointer"
        )}
        onClick={() => isClickable && setIsExpanded(!isExpanded)}
      >
        <span className="text-base">{emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-xs font-medium text-foreground/80">{title}</span>
            <span className="text-xs text-muted-foreground/70">• {date.trim()}</span>
            {quantityInfo && (
              <span className="text-xs text-muted-foreground/70">• {quantityInfo}</span>
            )}
          </div>
          {description && (
            <div className="mt-0.5">
              <p className={cn("text-xs text-muted-foreground/60", !isExpanded && isLong && "line-clamp-1")}>
                {description}
              </p>
              {isLong && (
                <span className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground/50">
                  {isExpanded ? "Show less" : "Read more"}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderSessionInfoCard = (sessionText: string) => {
    return <SessionInfoCard sessionText={sessionText} />;
  };

  const renderMessageContent = (message: any) => {
    const content =
      typeof message.content === "string"
        ? message.content
        : toDisplayErrorMessage(message.content, "");
    const sessionPattern = /\[About: .+?\]\n\n/;
    const sessionMatch = content.match(sessionPattern);

    if (sessionMatch) {
      const sessionCard = renderSessionInfoCard(sessionMatch[0]);
      const restOfMessage = content.replace(sessionPattern, '');

      return (
        <>
          {sessionCard}
          {message.role === "COACH" ? (
            renderCoachContent({ ...message, content: restOfMessage })
          ) : (
            <div className="space-y-2">
              {restOfMessage.trim() && <MessageMarkdown>{restOfMessage}</MessageMarkdown>}
              <MessageImageAttachments
                images={message.imageAttachments}
                onOpen={setZoomedImage}
              />
            </div>
          )}
        </>
      );
    }

    if (message.role !== "COACH") {
      return (
        <div className="space-y-2">
          {content.trim() && <MessageMarkdown>{content}</MessageMarkdown>}
          <MessageImageAttachments
            images={message.imageAttachments}
            onOpen={setZoomedImage}
          />
        </div>
      );
    }

    return renderCoachContent(message);
  };

  const renderCoachContent = (message: any) => {
    const content =
      typeof message.content === "string"
        ? message.content
        : toDisplayErrorMessage(message.content, "");
    const parts: (string | JSX.Element)[] = [];
    const replacements: Array<{
      index: number;
      length: number;
      component: JSX.Element;
    }> = [];
    const citationSources = getCitationSources(content, message.toolCalls);
    const hasOverlap = (index: number, length: number) =>
      replacements.some(
        (replacement) =>
          index < replacement.index + replacement.length &&
          index + length > replacement.index
      );

    if (message.metricReplacement) {
      const index = content.indexOf(message.metricReplacement.textToReplace);
      if (index !== -1) {
        replacements.push({
          index,
          length: message.metricReplacement.textToReplace.length,
          component: (
            <MetricSuggestion
              key="metric"
              messageId={message.id}
              metricId={message.metricReplacement.metric.id}
              metricTitle={message.metricReplacement.metric.title}
              rating={message.metricReplacement.rating}
              displayText={message.metricReplacement.textToReplace}
              emoji={message.metricReplacement.metric.emoji}
              status={message.metricReplacement.status}
              onAccept={handleAcceptMetric}
              onReject={handleRejectMetric}
            />
          ),
        });
      }
    }

    const entityPattern = /\{\{(plan|activity):([^|{}\s]+)\|([^{}]+?)\}\}/g;
    let entityMatch: RegExpExecArray | null;
    let hasDslEntities = false;

    while ((entityMatch = entityPattern.exec(content)) !== null) {
      const [raw, type, id, label] = entityMatch;
      const index = entityMatch.index;
      const cleanLabel = label.trim();

      if (hasOverlap(index, raw.length)) continue;

      if (type === "plan") {
        const plan = plans?.find((item: any) => item.id === id);
        replacements.push({
          index,
          length: raw.length,
          component: plan ? (
            <PlanLink
              key={`entity-plan-${message.id}-${index}`}
              planId={id}
              displayText={cleanLabel}
              emoji={plan.emoji || undefined}
            />
          ) : (
            <span key={`entity-plan-missing-${message.id}-${index}`}>
              {cleanLabel}
            </span>
          ),
        });
        hasDslEntities = true;
      } else if (type === "activity") {
        const activity = activities?.find((item: any) => item.id === id);
        replacements.push({
          index,
          length: raw.length,
          component: activity ? (
            <ActivityLink
              key={`entity-activity-${message.id}-${index}`}
              activityId={id}
              displayText={cleanLabel}
              emoji={activity.emoji || undefined}
            />
          ) : (
            <span key={`entity-activity-missing-${message.id}-${index}`}>
              {cleanLabel}
            </span>
          ),
        });
        hasDslEntities = true;
      }
    }

    if (!hasDslEntities && message.planReplacements) {
      message.planReplacements.forEach((replacement: any, idx: number) => {
        const textToFind = replacement.textToReplace;
        const baseIndex = content.indexOf(textToFind);
        if (baseIndex !== -1) {
          let startIndex = baseIndex;
          const beforeText = content.substring(Math.max(0, baseIndex - 10), baseIndex);

          const emoji = replacement.plan.emoji || '';
          const prefixPatterns = [
            `**"${emoji} `,
            `**"${emoji}`,
            `**"`,
            `**`,
            `"${emoji} `,
            `"${emoji}`,
            `"`,
            `${emoji} `,
            `${emoji}`,
          ].filter(p => p.length > 0);

          for (const prefix of prefixPatterns) {
            if (beforeText.endsWith(prefix)) {
              startIndex = baseIndex - prefix.length;
              break;
            }
          }

          let endIndex = baseIndex + textToFind.length;
          const afterText = content.substring(endIndex, endIndex + 5);

          const suffixPatterns = [`"**`, `**`, `"`];
          for (const suffix of suffixPatterns) {
            if (afterText.startsWith(suffix)) {
              endIndex = endIndex + suffix.length;
              break;
            }
          }

          replacements.push({
            index: startIndex,
            length: endIndex - startIndex,
            component: (
              <PlanLink
                key={`plan-${idx}`}
                planId={replacement.plan.id}
                displayText={sanitizePlanDisplayText(
                  replacement.textToReplace,
                  replacement.plan.emoji
                )}
                emoji={replacement.plan.emoji || undefined}
              />
            ),
          });
        }
      });
    }

    citationSources.forEach((source, idx) => {
      let searchFrom = 0;
      while (searchFrom < content.length) {
        const index = content.indexOf(source.citationLabel, searchFrom);
        if (index === -1) break;
        if (!hasOverlap(index, source.citationLabel.length)) {
          replacements.push({
            index,
            length: source.citationLabel.length,
            component: <CitationPill key={`citation-${idx}-${index}`} source={source} />,
          });
        }
        searchFrom = index + source.citationLabel.length;
      }
    });

    replacements.sort((a, b) => {
      if (a.index !== b.index) return a.index - b.index;
      return b.length - a.length;
    });

    const nonOverlappingReplacements: typeof replacements = [];
    let lastReplacementEnd = 0;
    for (const replacement of replacements) {
      if (replacement.index < lastReplacementEnd) continue;
      nonOverlappingReplacements.push(replacement);
      lastReplacementEnd = replacement.index + replacement.length;
    }

    let lastIndex = 0;
    nonOverlappingReplacements.forEach((replacement) => {
      if (replacement.index > lastIndex) {
        parts.push(content.substring(lastIndex, replacement.index));
      }
      parts.push(replacement.component);
      lastIndex = replacement.index + replacement.length;
    });

    if (lastIndex < content.length) {
      parts.push(content.substring(lastIndex));
    }

    const renderTextPart = (text: string, isFirst: boolean, isLast: boolean) => {
      let processedText = text;

      if (!isFirst) {
        if (processedText.match(/^[ ]*-[ ]/)) {
          processedText = processedText.replace(/^([ ]*)-( )/, '$1\\-$2');
        }
      }

      if (!isLast) {
        processedText = processedText.replace(/(\n\d+)\. $/g, '$1\\. ');
      }

      return <MessageMarkdown>{processedText}</MessageMarkdown>;
    };

    const renderInlineTokens = (tokens: (string | JSX.Element)[], keyPrefix: string) =>
      tokens.map((token, tokenIdx) => {
        if (typeof token === "string") {
          if (!token) return null;
          return (
            <MessageMarkdown key={`${keyPrefix}-text-${tokenIdx}`}>
              {token}
            </MessageMarkdown>
          );
        }

        return <span key={`${keyPrefix}-component-${tokenIdx}`}>{token}</span>;
      });

    const stripLeadingText = (
      tokens: (string | JSX.Element)[],
      lengthToStrip: number
    ) => {
      let remaining = lengthToStrip;
      return tokens
        .map((token) => {
          if (remaining <= 0 || typeof token !== "string") return token;
          const nextToken = token.slice(remaining);
          remaining = Math.max(0, remaining - token.length);
          return nextToken;
        })
        .filter((token) => typeof token !== "string" || token.length > 0);
    };

    const renderMixedParts = () => {
      const lines: (string | JSX.Element)[][] = [[]];

      parts.forEach((part) => {
        if (typeof part !== "string") {
          lines[lines.length - 1].push(part);
          return;
        }

        part.split(/(\n)/).forEach((segment) => {
          if (segment === "\n") {
            lines.push([]);
          } else if (segment) {
            lines[lines.length - 1].push(segment);
          }
        });
      });

      const rendered: JSX.Element[] = [];
      let pendingListItems: (string | JSX.Element)[][] = [];

      const flushList = () => {
        if (pendingListItems.length === 0) return;
        const listIndex = rendered.length;
        rendered.push(
          <ul
            key={`mixed-list-${listIndex}`}
            className="my-1 list-outside list-disc space-y-0 whitespace-normal pl-5 leading-snug"
          >
            {pendingListItems.map((tokens, itemIdx) => (
              <li
                key={`mixed-list-${listIndex}-${itemIdx}`}
                className="pl-0 leading-snug marker:text-muted-foreground"
              >
                {renderInlineTokens(tokens, `mixed-list-${listIndex}-${itemIdx}`)}
              </li>
            ))}
          </ul>
        );
        pendingListItems = [];
      };

      lines.forEach((line, lineIdx) => {
        const lineText = line
          .map((token) => (typeof token === "string" ? token : ""))
          .join("");
        const bulletMatch = lineText.match(/^\s*[-*]\s+/);

        if (bulletMatch) {
          pendingListItems.push(stripLeadingText(line, bulletMatch[0].length));
          return;
        }

        flushList();

        if (line.length === 0 || lineText.trim().length === 0) {
          rendered.push(<div key={`mixed-gap-${lineIdx}`} className="h-2" />);
          return;
        }

        rendered.push(
          <div
            key={`mixed-line-${lineIdx}`}
            className="whitespace-pre-wrap break-words leading-snug [overflow-wrap:anywhere]"
          >
            {renderInlineTokens(line, `mixed-line-${lineIdx}`)}
          </div>
        );
      });

      flushList();
      return rendered;
    };

    if (nonOverlappingReplacements.length > 0) {
      return <>{renderMixedParts()}</>;
    }

    return (
      <>
        {parts.map((part, idx) => {
          if (typeof part === "string") {
            const isFirst = idx === 0;
            const isLast = idx === parts.length - 1;
            return <span key={idx}>{renderTextPart(part, isFirst, isLast)}</span>;
          }
          return part;
        })}
      </>
    );
  };

  if (isLoadingChats) {
    return (
      <div className="flex h-screen bg-background items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background relative z-50 overflow-hidden">
      <div className="grid flex-1 grid-cols-1 grid-rows-1 w-full max-w-full overflow-hidden">
        <div
          ref={topChromeRef}
          className="z-30 col-start-1 row-start-1 self-start sticky top-0 bg-gradient-to-b from-background via-background/90 to-background/0"
     
        >
   
   
          {/* Header */}
          <div className="w-full max-w-4xl mx-auto px-4 pt-3 pb-12">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate({ to: "/messages" })}
                >
                  <ArrowLeft size={20} />
                </Button>
                <div className="relative flex items-center">
                  {hasCoachAttention && (
                    <button
                      type="button"
                      className="absolute -left-1 top-1/2 z-20 flex h-7 min-w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-1 rounded-full border border-background bg-amber-500 px-2 text-xs font-bold text-background shadow-lg motion-safe:animate-pulse"
                      onClick={() => setShowCoachAttentionDrawer(true)}
                      aria-label={`${coachAttentionCount} plan update${coachAttentionCount === 1 ? "" : "s"} need attention`}
                    >
                      <AlertTriangle className="h-3.5 w-3.5" />
                      <span>{coachAttentionCount}</span>
                    </button>
                  )}
                  <button
                    className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                    onClick={() => navigate({ to: "/manage-ai-coach" })}
                  >
                    <img src={aiCoach.avatar} alt={aiCoach.label} className="w-10 h-10 object-contain" />
                    <div className="text-left">
                      <h1 className="font-semibold text-foreground">{aiCoach.name}</h1>
                      <p className="text-xs text-muted-foreground">AI Coach</p>
                    </div>
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowCoachContext(true)}
                  aria-label={`What ${aiCoach.name} can see`}
                >
                  <Eye size={18} />
                </Button>
                <div className="relative">
                  <Button
                    ref={menuButtonRef}
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (!showMenu) updateMenuPosition();
                      setShowMenu(!showMenu);
                    }}
                  >
                    <EllipsisVertical size={18} />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
        {showMenu && menuPosition && (
          <div
            ref={menuRef}
            className="fixed w-56 rounded-xl border border-border bg-card/50 backdrop-blur-md py-1 shadow-xl z-[1000]"
            style={{
              top: menuPosition.top,
              right: menuPosition.right,
            }}
          >
            <button
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm text-foreground hover:bg-muted transition-colors"
              onClick={async () => {
                setShowMenu(false);
                try {
                  await createCoachChat({ title: null });
                  toast.success("New conversation started");
                } catch {
                  toast.error("Failed to create conversation");
                }
              }}
              disabled={isCreatingCoachChat || isClearingCoachHistory}
            >
              <MessageSquarePlus size={16} />
              New conversation
            </button>
            <button
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm text-foreground hover:bg-muted transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => {
                setShowMenu(false);
                void handleRunCoachAssessment();
              }}
              disabled={isRunningCoachAssessment}
            >
              {isRunningCoachAssessment ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Sparkles size={16} />
              )}
              Assess
            </button>
            <button
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm text-foreground hover:bg-muted transition-colors"
              onClick={() => {
                setShowMenu(false);
                navigate({ to: "/manage-ai-coach" });
              }}
            >
              <Settings size={16} />
              Settings
            </button>
            <button
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm text-destructive hover:bg-muted transition-colors"
              onClick={() => {
                setShowMenu(false);
                setShowClearDialog(true);
              }}
            >
              <Eraser size={16} />
              Clear messages
            </button>
          </div>
        )}

        <AppleLikePopover
          open={showCoachContext}
          onClose={() => setShowCoachContext(false)}
          title={`What ${aiCoach.name} can see`}
          className="sm:max-w-xl"
        >
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                <Eye size={18} className="text-muted-foreground" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  What {aiCoach.name} can see
                </h2>
                <p className="text-sm text-muted-foreground">
                  Recent logs, active plans, and upcoming sessions.
                </p>
              </div>
            </div>
            <CoachContextContent
              recentActivities={recentActivities}
              activePlans={activePlans}
              gridData={gridData}
              isCompletedOnDay={isCompletedOnDay}
            />
          </div>
        </AppleLikePopover>

        <CoachAttentionDrawer
          open={showCoachAttentionDrawer}
          onOpenChange={setShowCoachAttentionDrawer}
          items={coachAttentionItems}
        />

        {/* Messages */}
        <div
          className="z-0 col-start-1 row-start-1 min-h-0 overflow-y-auto"
          ref={messagesContainerRef}
          style={{
            paddingTop: chromeInsets.top,
            paddingBottom: chromeInsets.bottom,
          }}
        >
          {/* floating date below island */}
          {/* {activeDateLabel && !isLoadingMessages && allMessages.length > 0 && (
            <div className="pointer-events-none sticky top-0 z-30 flex h-0 justify-center">
              <span className="-mt-2 inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-3 text-xs font-semibold text-muted-foreground shadow-sm">
                {activeDateLabel}
                <ChevronDown size={12} />
              </span>
            </div>
          )} */}
          <div className="w-full max-w-4xl mx-auto px-4 py-6">
            {isLoadingMessages ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : allMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                <div>
                  <h3 className="font-semibold text-lg">No messages yet</h3>
                  <p className="text-sm text-muted-foreground">
                    Run an assessment to get a first read on your active plans.
                  </p>
                </div>
                <Button
                  onClick={handleRunCoachAssessment}
                  disabled={isRunningCoachAssessment}
                  className="gap-2"
                >
                  {isRunningCoachAssessment ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Sparkles size={16} />
                  )}
                  Run coach assessment
                </Button>
              </div>
            ) : (
              allMessages.map((message: any, index: number) => {
                const isUserMessage = message.role === "USER" || message.senderId === currentUser?.id;
                const isCoachMessage = message.role === "COACH";
                const isAssessmentMessage =
                  isCoachMessage && message.source === "autonomous_coach";

                const prevMessage = allMessages[index - 1];
                const nextMessage = allMessages[index + 1];
                const prevIsAssessment =
                  prevMessage?.role === "COACH" &&
                  prevMessage.source === "autonomous_coach";
                const nextIsAssessment =
                  nextMessage?.role === "COACH" &&
                  nextMessage.source === "autonomous_coach";
                const messageDate = new Date(message.createdAt);
                const showDateDivider = !prevMessage ||
                  !isSameDay(messageDate, new Date(prevMessage.createdAt));
                const showAssessmentStart =
                  isAssessmentMessage && (!prevIsAssessment || showDateDivider);
                const showAssessmentEnd =
                  isAssessmentMessage && !nextIsAssessment;

                // Show feedback only on the last coach message before a non-coach message (or end of list)
                const isLastInCoachGroup = isCoachMessage && (!nextMessage || nextMessage.role !== "COACH");

                const prevIsUser = prevMessage && (prevMessage.role === "USER" || prevMessage.senderId === currentUser?.id);
                const prevIsCoach = prevMessage && prevMessage.role === "COACH";
                const isSameSenderAsPrev = (isUserMessage && prevIsUser) || (isCoachMessage && prevIsCoach);
                const messageSpacing = !prevMessage ? "" : isSameSenderAsPrev && !showDateDivider ? "mt-1" : "mt-4";
                const canEditMessage =
                  isUserMessage &&
                  message.role === "USER" &&
                  !message.userAction &&
                  !(message.imageAttachments?.length > 0) &&
                  typeof message.content === "string" &&
                  !message.id.startsWith("temp-");
                const canCopyMessage = !!getMessageCopyText(message);
                const showActionRow = isUserMessage
                  ? canCopyMessage || canEditMessage
                  : activeActionMessageId === message.id &&
                  (canCopyMessage || isLastInCoachGroup);
                const ownToolCalls = Array.isArray(message.toolCalls)
                  ? message.toolCalls
                  : [];
                let inheritedWebSearchToolCalls: any[] = [];

                if (
                  isCoachMessage &&
                  ownToolCalls.length === 0 &&
                  typeof message.content === "string" &&
                  /\[\d+\]/.test(message.content)
                ) {
                  for (let i = index - 1; i >= 0; i -= 1) {
                    const previousCoachMessage = allMessages[i];
                    if (previousCoachMessage?.role !== "COACH") break;

                    const webSearchToolCalls = (
                      previousCoachMessage.toolCalls || []
                    ).filter((toolCall: any) => toolCall.tool === "webSearch");

                    if (webSearchToolCalls.length > 0) {
                      inheritedWebSearchToolCalls = webSearchToolCalls;
                      break;
                    }
                  }
                }

                const displayToolCalls =
                  ownToolCalls.length > 0
                    ? ownToolCalls
                    : inheritedWebSearchToolCalls;
                const messageForRendering =
                  displayToolCalls.length > 0 && ownToolCalls.length === 0
                    ? { ...message, toolCalls: displayToolCalls }
                    : message;

                return (
                  <MessageWithReadTracking
                    key={message.id}
                    message={message}
                    isOwnMessage={isUserMessage}
                    onVisible={
                      message.chatId === currentChatId
                        ? queueMessageForRead
                        : () => undefined
                    }
                    className={messageSpacing}
                    dateLabel={formatRelativeDate(messageDate)}
                  >
                    {showDateDivider && <DateDivider date={messageDate} />}
                    {showAssessmentStart && <AssessmentDivider position="start" />}
                    <div
                      className={`flex min-w-0 max-w-full gap-3 overflow-visible ${isUserMessage ? "flex-row-reverse" : "flex-row"
                        }`}
                    >
                      <div className="flex min-w-0 max-w-full flex-col gap-1 overflow-visible">
                        <div
                          className={cn(
                            "flex min-w-0 max-w-full items-end gap-1",
                            isCoachMessage && "cursor-pointer"
                          )}
                          onClick={
                            isCoachMessage
                              ? () => toggleCoachMessageActions(message.id)
                              : undefined
                          }
                        >
                          {isUserMessage && message.userAction ? (
                            <UserActionCard
                              action={message.userAction}
                              timestamp={message.createdAt}
                            />
                          ) : (
                            <MessageBubble
                              direction={isUserMessage ? "right" : "left"}
                              timestamp={message.createdAt}
                              className={
                                isUserMessage
                                  ? "bg-muted-foreground/20"
                                  : "bg-muted/60"
                              }
                            >
                              <div className="min-w-0 break-words text-sm [overflow-wrap:anywhere]">
                                {renderMessageContent(messageForRendering)}
                              </div>
                            </MessageBubble>
                          )}
                        </div>
                        <AnimatePresence initial={false}>
                          {showActionRow && (
                            <motion.div
                              initial={{ height: 0, opacity: 0, marginTop: 0 }}
                              animate={{ height: "auto", opacity: 1, marginTop: 4 }}
                              exit={{ height: 0, opacity: 0, marginTop: 0 }}
                              transition={{ duration: 0.16, ease: "easeOut" }}
                              className={cn(
                                "overflow-hidden",
                                isUserMessage ? "self-end" : "self-start"
                              )}
                            >
                              <div className="flex items-center gap-1 px-1">
                                {canCopyMessage && (
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleCopyMessage(message);
                                    }}
                                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                                    title="Copy"
                                    aria-label="Copy message"
                                  >
                                    {copiedMessageId === message.id ? (
                                      <Check size={17} />
                                    ) : (
                                      <Copy size={17} />
                                    )}
                                  </button>
                                )}
                                {canEditMessage && (
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      const sourceChatId = message.chatId || currentChatId;
                                      if (!sourceChatId) return;
                                      if (pendingSession) clearPendingSession();
                                      setEditingMessage({
                                        id: message.id,
                                        chatId: sourceChatId,
                                        content: message.content,
                                      });
                                      setInputValue(message.content);
                                    }}
                                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                                    title="Edit and resend from here"
                                    aria-label="Edit and resend from here"
                                  >
                                    <Pencil size={17} />
                                  </button>
                                )}
                                {isLastInCoachGroup && (
                                  <MessageFeedback
                                    messageId={message.id}
                                    existingFeedback={
                                      message.feedback && message.feedback.length > 0
                                        ? message.feedback[0]
                                        : null
                                    }
                                    onSubmitFeedback={async (data) => {
                                      await submitFeedback(data);
                                    }}
                                    isSubmitting={isSubmittingFeedback}
                                    className="mt-0"
                                  />
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {isCoachMessage && message.error && (
                          <div className="flex items-center gap-1 px-1">
                            <AlertCircle size={12} className="text-red-500" />
                            <span className="text-xs text-muted-foreground">We are investigating this issue</span>
                          </div>
                        )}

                        {isCoachMessage && message.planProposals && message.planProposals.filter(hasProposalChanges).length > 0 && (
                          <div className="px-0">
                            {message.planProposals.map((proposal: any, originalIndex: number) => ({ proposal, originalIndex })).filter(({ proposal }: any) => hasProposalChanges(proposal)).map(({ proposal, originalIndex }: any) => {
                              const plan = plans?.find(p => p.id === proposal.planId);
                              const resolvedOperations: ResolvedOperation[] =
                                proposal.patch
                                  ? resolvePatchOperations(proposal.patch, plan, activities || [])
                                  : (proposal.operations || []).map((op: any) =>
                                    resolveLegacyOperation(op, plan, activities || [])
                                  );
                              return (
                                <PlanProposalCard
                                  key={`proposal-${message.id}-${originalIndex}`}
                                  messageId={message.id}
                                  proposalIndex={originalIndex}
                                  planGoal={proposal.planGoal}
                                  planEmoji={proposal.planEmoji}
                                  description={proposal.description}
                                  operations={resolvedOperations}
                                  plan={plan}
                                  status={proposal.status}
                                  onAccept={handleAcceptProposal}
                                  onReject={handleRejectProposal}
                                />
                              );
                            })}
                          </div>
                        )}

                        {isCoachMessage && message.planCreationProposals && message.planCreationProposals.length > 0 && (
                          <div className="px-0">
                            {message.planCreationProposals.map((proposal: any, idx: number) => (
                              <PlanCreationProposalCard
                                key={`plan-creation-${message.id}-${idx}`}
                                messageId={message.id}
                                proposalIndex={idx}
                                goal={proposal.goal}
                                goalReason={proposal.goalReason}
                                emoji={proposal.emoji}
                                outlineType={proposal.outlineType}
                                timesPerWeek={proposal.timesPerWeek}
                                activities={proposal.activities}
                                finishingDate={proposal.finishingDate}
                                notes={proposal.notes}
                                milestones={proposal.milestones}
                                sessions={proposal.sessions}
                                description={proposal.description}
                                status={proposal.status}
                                planId={proposal.planId}
                                onAccept={handleAcceptPlanCreationProposal}
                                onReject={handleRejectPlanCreationProposal}
                                onProposeChanges={handleProposePlanCreationChanges}
                              />
                            ))}
                          </div>
                        )}

                        {isCoachMessage && message.activityLogProposals && message.activityLogProposals.length > 0 && (
                          <div className="px-0">
                            {message.activityLogProposals.map((proposal: any, idx: number) => (
                              <ActivityLogProposalCard
                                key={`activity-log-${message.id}-${idx}`}
                                messageId={message.id}
                                proposalIndex={idx}
                                activityName={proposal.activityName}
                                activityEmoji={proposal.activityEmoji}
                                activityMeasure={proposal.activityMeasure}
                                quantity={proposal.quantity}
                                date={proposal.date}
                                time={proposal.time}
                                description={proposal.description}
                                privateNotes={proposal.privateNotes}
                                difficulty={proposal.difficulty}
                                status={proposal.status}
                                onAccept={handleAcceptActivityLogProposal}
                                onReject={handleRejectActivityLogProposal}
                              />
                            ))}
                          </div>
                        )}

                        {isCoachMessage && message.activityEditProposals && message.activityEditProposals.length > 0 && (
                          <div className="px-0">
                            {message.activityEditProposals.map((proposal: any, idx: number) => (
                              <ActivityEditProposalCard
                                key={`activity-edit-${message.id}-${idx}`}
                                messageId={message.id}
                                proposalIndex={idx}
                                activityName={proposal.activityName}
                                activityEmoji={proposal.activityEmoji}
                                description={proposal.description}
                                original={proposal.original}
                                requested={proposal.requested}
                                measureConversion={proposal.measureConversion}
                                status={proposal.status}
                                onAccept={handleAcceptActivityEditProposal}
                                onReject={handleRejectActivityEditProposal}
                              />
                            ))}
                          </div>
                        )}

                        {isCoachMessage && message.userContextEventProposals && message.userContextEventProposals.length > 0 && (
                          <div className="px-0">
                            {message.userContextEventProposals.map((proposal: any, idx: number) => (
                              <UserContextEventProposalCard
                                key={`context-event-${message.id}-${idx}`}
                                messageId={message.id}
                                proposalIndex={idx}
                                title={proposal.title}
                                description={proposal.description}
                                occurredAt={proposal.occurredAt}
                                endedAt={proposal.endedAt}
                                status={proposal.status}
                                onAccept={handleAcceptUserContextEventProposal}
                                onReject={handleRejectUserContextEventProposal}
                              />
                            ))}
                          </div>
                        )}

                        {isCoachMessage && displayToolCalls.length > 0 && (
                          <CoachToolCallsCard
                            toolCalls={displayToolCalls}
                            content={message.content}
                            plans={plans?.map(p => ({ id: p.id, goal: p.goal, emoji: p.emoji }))}
                          />
                        )}

                        {isCoachMessage && message.userRecommendations && (
                          <UserRecommendationCards
                            recommendations={message.userRecommendations}
                          />
                        )}
                      </div>
                    </div>
                    {showAssessmentEnd && <AssessmentDivider position="end" />}
                  </MessageWithReadTracking>
                );
              })
            )}
            {coachResponseTimedOut && !hasActiveCoachRequest && (
              <div className="mt-4 flex items-center gap-2 px-1 text-xs text-muted-foreground">
                <AlertCircle size={13} className="text-red-500" />
                <span>
                  {coachResponseErrorMessage ||
                    "Coach response timed out. The reply may still appear here if it finishes."}
                </span>
              </div>
            )}
            {(hasActiveCoachRequest || pendingStaggeredMessages.length > 0) && (!coachResponseTimedOut || hasActiveCoachRequest) && (
              <div
                className="flex flex-col items-start gap-1 mt-4 opacity-0"
                style={{ animation: "typing-appear 0.3s ease-out 1s forwards" }}
              >
                <MessageBubble direction="left" className="bg-muted/60">
                  <div className="flex items-center gap-[5px] px-1 py-1">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="w-[7px] h-[7px] rounded-full bg-muted-foreground/60"
                        style={{
                          animation: `typing-dot 1.4s ease-in-out ${1 + i * 0.2}s infinite`,
                        }}
                      />
                    ))}
                  </div>
                </MessageBubble>
                {coachLoadingLabel && (
                  <div className="ml-1 text-xs text-muted-foreground">
                    {coachLoadingLabel}
                  </div>
                )}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div
          ref={bottomChromeRef}
          className="z-30 col-start-1 row-start-1 self-end bg-gradient-to-t from-background via-background/60 to-background/0 pb-4 pt-2"
        >
          <div className="w-full max-w-4xl mx-auto px-4 space-y-2">
            {editingMessage && (
              <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/70 backdrop-blur-sm px-3 py-2">
                <Pencil size={15} className="text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-foreground">
                    Editing old message
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    Sending will discard this message and everything after it.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingMessage(null);
                    setInputValue("");
                  }}
                  className="rounded-md p-1 transition-colors hover:bg-muted"
                >
                  <X size={16} className="text-muted-foreground" />
                </button>
              </div>
            )}
            {pendingSession && (
              <div className={cn(
                "flex items-center gap-3 p-3 rounded-xl border",
                variants.fadedBg,
                variants.border
              )}>
                <span className="text-2xl">{pendingSession.activityEmoji || "📋"}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                      {pendingSession.activityTitle}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      • {format(new Date(pendingSession.date), "EEE, MMM d")}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {pendingSession.planEmoji || "📋"} {pendingSession.planGoal}
                  </p>
                </div>
                <button
                  onClick={clearPendingSession}
                  className="p-1 rounded-md hover:bg-muted transition-colors"
                >
                  <X size={16} className="text-muted-foreground" />
                </button>
              </div>
            )}
            <ChatMessageComposer
              value={inputValue}
              onValueChange={setInputValue}
              onSend={handleSend}
              placeholder={
                editingMessage
                  ? "Edit and resend..."
                  : pendingSession
                    ? "Ask about this session..."
                    : "Ask anything"
              }
              disabled={isSendingMessage || isRewritingMessage || !currentChatId}
              isSending={isSendingMessage || isRewritingMessage}
              imagesDisabled={!!editingMessage}
              ariaLabel={editingMessage ? "Edit message" : "Message"}
              resetAttachmentsKey={editingMessage?.id || "compose"}
            />
          </div>
        </div>
      </div>

      <ConfirmDialogOrPopover
        isOpen={showClearDialog}
        onClose={() => setShowClearDialog(false)}
        onConfirm={handleClearHistory}
        title="Clear coach messages?"
        description={`This will delete your coach chat history and erase ${aiCoach.name}'s memory of past interactions. This action cannot be undone.`}
        confirmText="Clear messages"
        variant="destructive"
        isConfirming={isClearingCoachHistory}
      />
      {zoomedImage && (
        <ImageZoomDialog
          open={!!zoomedImage}
          onOpenChange={(open) => {
            if (!open) {
              setZoomedImage(null);
            }
          }}
          src={zoomedImage.src}
          alt={zoomedImage.alt}
        />
      )}
    </div>
  );
}

export default MessageAIPage;
