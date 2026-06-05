import { Button } from "@/components/ui/button";
import AppleLikePopover from "@/components/AppleLikePopover";
import {
  CalendarGrid,
  type CalendarActivity,
  type CalendarSession,
} from "@/components/CalendarGrid";
import {
  DraftActivitiesEditor,
  PlanDurationEditor,
  PlanEmojiEditor,
  PlanFrequencyEditor,
  PlanOutlineTypeEditor,
  type DraftPlanActivity,
} from "@/components/plan-wizard/PlanFieldEditors";
import { useActivities } from "@/contexts/activities/useActivities";
import { useThemeColors } from "@/hooks/useThemeColors";
import {
  Calendar,
  CalendarCheck,
  Check,
  CheckCircle2,
  ChevronRight,
  Dumbbell,
  Flag,
  Goal,
  Info,
  Loader2,
  Plus,
  RefreshCw,
  Smile,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { format, parseISO } from "date-fns";
import { useNavigate } from "@tanstack/react-router";
import { PlanNotesBlock } from "./PlanNotesBlock";

type PlanCreationActivity = DraftPlanActivity & {
  activityId?: string | null;
  title: string;
  measure: string;
  emoji: string;
  kind?: string | null;
};

type PlanCreationMilestone = {
  description: string;
  date?: string | null;
  criteria?: string | null;
};

type PlanCreationSession = {
  activityTitle: string;
  date: string;
  quantity?: number | null;
  descriptiveGuide?: string | null;
};

type PlanCreationRequestedProposal = {
  goal: string;
  goalReason: string | null;
  emoji: string;
  outlineType: "SPECIFIC" | "TIMES_PER_WEEK";
  timesPerWeek: number | null;
  finishingDate: string | null;
  activities: Array<{
    activityId?: string | null;
    title: string;
    measure: string;
    emoji: string;
    kind: string | null;
  }>;
};

interface PlanCreationProposalCardProps {
  messageId: string;
  proposalIndex: number;
  goal: string;
  goalReason?: string | null;
  emoji?: string | null;
  outlineType?: "SPECIFIC" | "TIMES_PER_WEEK" | null;
  timesPerWeek?: number | null;
  activities?: PlanCreationActivity[];
  finishingDate?: string | null;
  notes?: string | null;
  milestones?: PlanCreationMilestone[];
  sessions?: PlanCreationSession[];
  description?: string;
  status?: "accepted" | "rejected" | "changes_requested" | "cancelled" | null;
  planId?: string | null;
  onAccept: (
    messageId: string,
    proposalIndex: number
  ) => Promise<{ success: boolean; plan?: { id: string } } | void>;
  onReject: (messageId: string, proposalIndex: number) => Promise<void>;
  onProposeChanges: (
    messageId: string,
    proposalIndex: number,
    requestedProposal: PlanCreationRequestedProposal,
    note?: string | null
  ) => Promise<void>;
}

interface ReviewRowProps {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  onClick?: () => void;
}

const formatDate = (value?: string | Date | null) => {
  if (!value) return null;
  try {
    return format(typeof value === "string" ? parseISO(value) : value, "MMM d, yyyy");
  } catch {
    return typeof value === "string" ? value : null;
  }
};

const ReviewRow = ({ icon, label, value, detail, onClick }: ReviewRowProps) => {
  const content = (
    <>
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted/50">
      {icon}
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="mt-0.5 text-sm font-medium text-foreground">{value}</div>
      {detail && <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{detail}</div>}
    </div>
      {onClick && <ChevronRight className="mt-3 h-4 w-4 shrink-0 text-muted-foreground" />}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-start gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:bg-muted/40"
      >
        {content}
      </button>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-3 text-left">
      {content}
    </div>
  );
};

const fieldClassName =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-foreground/40";

const normalizeDraft = (data: {
  goal: string;
  goalReason: string;
  emoji: string;
  outlineType: "SPECIFIC" | "TIMES_PER_WEEK";
  timesPerWeek: number | null;
  finishingDate: Date | null;
  activities: PlanCreationActivity[];
}) => ({
  goal: data.goal.trim(),
  goalReason: data.goalReason.trim() || null,
  emoji: data.emoji.trim() || "🎯",
  outlineType: data.outlineType,
  timesPerWeek: data.timesPerWeek || null,
  finishingDate: data.finishingDate ? format(data.finishingDate, "yyyy-MM-dd") : null,
  activities: data.activities
    .map((activity) => ({
      activityId: activity.activityId || null,
      title: activity.title.trim(),
      measure: activity.measure.trim() || "sessions",
      emoji: activity.emoji.trim() || "📋",
      kind: activity.kind || null,
    }))
    .filter((activity) => activity.title.length > 0),
});

const getActivityKey = (activity: PlanCreationActivity, index: number) =>
  `${activity.title.trim().toLowerCase() || "activity"}-${index}`;

const getActivityTitleKey = (activity: Pick<PlanCreationActivity, "title">) =>
  activity.title.trim().toLowerCase();

type ProposalEditor =
  | "goal"
  | "emoji"
  | "planType"
  | "frequency"
  | "finishingDate"
  | "activities"
  | "note";

export function PlanCreationProposalCard({
  messageId,
  proposalIndex,
  goal,
  goalReason,
  emoji,
  outlineType,
  timesPerWeek,
  activities = [],
  finishingDate,
  notes,
  milestones = [],
  sessions = [],
  description,
  status,
  planId,
  onAccept,
  onReject,
  onProposeChanges,
}: PlanCreationProposalCardProps) {
  const navigate = useNavigate();
  const themeColors = useThemeColors();
  const { activities: allActivities } = useActivities();
  const [isAccepted, setIsAccepted] = useState(status === "accepted");
  const [acceptedPlanId, setAcceptedPlanId] = useState<string | null>(
    planId || null
  );
  const [isRejected, setIsRejected] = useState(status === "rejected");
  const [isChangesRequested, setIsChangesRequested] = useState(
    status === "changes_requested"
  );
  const isCancelled = status === "cancelled";
  const [isLoading, setIsLoading] = useState(false);
  const [isProposingChanges, setIsProposingChanges] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeEditor, setActiveEditor] = useState<ProposalEditor | null>(null);
  const hasScheduledSessions = sessions.length > 0;
  const effectiveOutlineType =
    hasScheduledSessions || !timesPerWeek
      ? outlineType || "SPECIFIC"
      : "TIMES_PER_WEEK";
  const visibleMilestones = milestones.filter((milestone) => milestone.description?.trim());
  const [draftGoal, setDraftGoal] = useState(goal || "");
  const [draftGoalReason, setDraftGoalReason] = useState(goalReason || "");
  const [draftEmoji, setDraftEmoji] = useState(emoji || "🎯");
  const [draftOutlineType, setDraftOutlineType] = useState<"SPECIFIC" | "TIMES_PER_WEEK">(
    effectiveOutlineType
  );
  const [draftTimesPerWeek, setDraftTimesPerWeek] = useState<number | null>(
    timesPerWeek || null
  );
  const [draftFinishingDate, setDraftFinishingDate] = useState<Date | null>(
    finishingDate ? parseISO(finishingDate) : null
  );
  const [draftActivities, setDraftActivities] = useState<PlanCreationActivity[]>(
    activities.map((activity) => ({ ...activity }))
  );
  const [draftNote, setDraftNote] = useState(notes || "");

  const originalDraft = normalizeDraft({
    goal,
    goalReason: goalReason || "",
    emoji: emoji || "🎯",
    outlineType: effectiveOutlineType,
    timesPerWeek: timesPerWeek || null,
    finishingDate: finishingDate ? parseISO(finishingDate) : null,
    activities,
  });

  const currentDraft = normalizeDraft({
    goal: draftGoal,
    goalReason: draftGoalReason,
    emoji: draftEmoji,
    outlineType: draftOutlineType,
    timesPerWeek: draftTimesPerWeek,
    finishingDate: draftFinishingDate,
    activities: draftActivities,
  });

  useEffect(() => {
    if (planId) {
      setAcceptedPlanId(planId);
    }
  }, [planId]);
  const existingActivityTitleKeys = new Set(
    (allActivities || []).map((activity) => getActivityTitleKey(activity))
  );
  const isNewActivity = (activity: Pick<PlanCreationActivity, "title" | "activityId">) =>
    !activity.activityId &&
    !existingActivityTitleKeys.has(getActivityTitleKey(activity));
  const newActivities = currentDraft.activities.filter(isNewActivity);
  const newActivityCount = newActivities.length;
  const draftCalendarActivities: CalendarActivity[] = currentDraft.activities.map(
    (activity, index) => ({
      id: getActivityKey(activity, index),
      title: activity.title,
      emoji: activity.emoji,
      measure: activity.measure,
    })
  );
  const calendarActivityByTitle = new Map(
    currentDraft.activities.map((activity, index) => [
      activity.title.trim().toLowerCase(),
      getActivityKey(activity, index),
    ])
  );
  const fallbackSessionActivities: CalendarActivity[] =
    draftCalendarActivities.length > 0
      ? []
      : Array.from(
          new Set(sessions.map((session) => session.activityTitle.trim()).filter(Boolean))
        ).map((title, index) => ({
          id: `proposal-fallback-${index}`,
          title,
          emoji: draftEmoji || "📋",
          measure: "minutes",
        }));
  const fallbackCalendarActivityByTitle = new Map(
    fallbackSessionActivities.map((activity) => [
      activity.title.trim().toLowerCase(),
      activity.id,
    ])
  );
  const calendarActivities = [
    ...draftCalendarActivities,
    ...fallbackSessionActivities,
  ];
  const fallbackCalendarActivityId = calendarActivities[0]?.id || "proposal-activity";
  const calendarSessions: CalendarSession[] = sessions.map((session, index) => ({
    id: `proposal-session-${proposalIndex}-${index}`,
    date: session.date,
    activityId:
      calendarActivityByTitle.get(session.activityTitle.trim().toLowerCase()) ||
      fallbackCalendarActivityByTitle.get(session.activityTitle.trim().toLowerCase()) ||
      fallbackCalendarActivityId,
    quantity: session.quantity ?? undefined,
    descriptiveGuide: session.descriptiveGuide || undefined,
  }));
  const firstSessionDate =
    calendarSessions.length > 0
      ? calendarSessions.reduce((earliest, session) => {
          const sessionDate = new Date(session.date);
          return sessionDate < earliest ? sessionDate : earliest;
        }, new Date(calendarSessions[0].date))
      : undefined;

  const hasDraftChanges =
    JSON.stringify(currentDraft) !== JSON.stringify(originalDraft) ||
    draftNote.trim().length > 0;

  const compactLabel = (
    <span>
      {emoji && <span className="mr-1">{emoji}</span>}
      {goal}
    </span>
  );

  const handleAccept = async () => {
    setIsLoading(true);
    try {
      const result = await onAccept(messageId, proposalIndex);
      setAcceptedPlanId(result?.plan?.id || acceptedPlanId);
      setIsAccepted(true);
      setIsDrawerOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSeeFullPlan = () => {
    if (!acceptedPlanId) return;
    setIsDrawerOpen(false);
    navigate({ to: "/plans", search: { selectedPlan: acceptedPlanId } });
  };

  const handleReject = async () => {
    setIsLoading(true);
    try {
      await onReject(messageId, proposalIndex);
      setIsRejected(true);
      setIsDrawerOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProposeChanges = async () => {
    setIsProposingChanges(true);
    try {
      await onProposeChanges(
        messageId,
        proposalIndex,
        currentDraft,
        draftNote.trim() || null
      );
      setIsChangesRequested(true);
      setIsDrawerOpen(false);
    } finally {
      setIsProposingChanges(false);
    }
  };

  const editorTitles: Record<ProposalEditor, string> = {
    goal: "Edit Goal",
    emoji: "Edit Emoji",
    planType: "Edit Plan Type",
    frequency: "Edit Frequency",
    finishingDate: "Edit Date",
    activities: "Edit Activities",
    note: "Edit Notes",
  };

  const closeEditor = () => setActiveEditor(null);
  const isResolved = isAccepted || isRejected || isChangesRequested || isCancelled;
  const openEditor = (editor: ProposalEditor) =>
    isResolved ? undefined : () => setActiveEditor(editor);
  const isTallEditor =
    activeEditor === "activities" ||
    activeEditor === "note" ||
    activeEditor === "goal";

  const editorDrawer = (
    <AppleLikePopover
      open={activeEditor !== null}
      onClose={closeEditor}
      title={activeEditor ? editorTitles[activeEditor] : "Edit"}
      className="sm:max-w-lg"
    >
      <div
        className={
          isTallEditor
            ? "flex max-h-[78dvh] w-full flex-col"
            : "flex w-full flex-col"
        }
      >
        <div className="flex shrink-0 flex-col items-center gap-2 pb-4 pt-2 text-center">
          <span className="text-5xl">{draftEmoji || "🎯"}</span>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {activeEditor ? editorTitles[activeEditor] : "Edit"}
          </h2>
        </div>

        <div
          className={
            isTallEditor
              ? "min-h-0 flex-1 overflow-y-auto px-1 pb-4"
              : "overflow-visible px-1 pb-4"
          }
        >
          {activeEditor === "goal" && (
            <div className="space-y-3">
              <label className="block space-y-1">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">Goal</span>
                <input
                  value={draftGoal}
                  onChange={(event) => setDraftGoal(event.target.value)}
                  className={fieldClassName}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">Why</span>
                <textarea
                  value={draftGoalReason}
                  onChange={(event) => setDraftGoalReason(event.target.value)}
                  className={`${fieldClassName} min-h-24 resize-none`}
                  placeholder="Why this matters"
                />
              </label>
            </div>
          )}

          {activeEditor === "emoji" && (
            <PlanEmojiEditor value={draftEmoji} onChange={setDraftEmoji} />
          )}

          {activeEditor === "planType" && (
            <PlanOutlineTypeEditor
              value={draftOutlineType}
              onChange={setDraftOutlineType}
            />
          )}

          {activeEditor === "frequency" && (
            <PlanFrequencyEditor
              value={draftTimesPerWeek || 1}
              onChange={setDraftTimesPerWeek}
            />
          )}

          {activeEditor === "finishingDate" && (
            <PlanDurationEditor
              value={draftFinishingDate}
              onChange={setDraftFinishingDate}
            />
          )}

          {activeEditor === "activities" && (
            <DraftActivitiesEditor
              activities={draftActivities}
              onChange={setDraftActivities}
              existingActivities={allActivities || []}
            />
          )}

          {activeEditor === "note" && (
            <label className="block space-y-1">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Notes for coach</span>
              <textarea
                value={draftNote}
                onChange={(event) => setDraftNote(event.target.value)}
                className={`${fieldClassName} min-h-48 resize-none`}
                placeholder="Roadmap, sources, constraints, baseline, or anything the coach should keep following"
              />
            </label>
          )}
        </div>

        <div className="shrink-0 border-t border-border bg-background px-1 pt-4">
          <Button type="button" className="w-full" onClick={closeEditor}>
            Done
          </Button>
        </div>
      </div>
    </AppleLikePopover>
  );

  const reviewDrawer = (
    <AppleLikePopover
      open={isDrawerOpen}
      onClose={() => {
        setIsDrawerOpen(false);
        setActiveEditor(null);
      }}
      title="Review Plan"
      className="max-h-[92dvh] sm:max-w-lg"
    >
      <div className="flex h-[calc(92dvh-2rem)] max-h-[760px] w-full flex-col">
        <div className="flex shrink-0 flex-col items-center gap-2 pb-4 pt-2 text-center">
          <span className="text-6xl">{draftEmoji || "🎯"}</span>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            Review Plan
          </h2>
          <p className="text-sm text-muted-foreground">
            What accepting this will set up
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-1 pb-4">
          {newActivityCount > 0 && (
            <div className="rounded-xl border border-dashed border-amber-500/60 bg-amber-500/10 p-3 text-left">
              <div className="text-sm font-semibold text-foreground">
                {newActivityCount} new activit{newActivityCount === 1 ? "y" : "ies"} will be created
              </div>
              <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
                New activities are marked with dashed styling and a "(new)" suffix. Existing activities will be reused.
              </div>
            </div>
          )}
          <ReviewRow
            icon={<Goal className="h-5 w-5 text-muted-foreground" />}
            label="Goal"
            value={draftGoal || "Not set"}
            detail={draftGoalReason ? `Why: ${draftGoalReason}` : "No reason captured yet."}
            onClick={openEditor("goal")}
          />
          <ReviewRow
            icon={<Smile className="h-5 w-5 text-muted-foreground" />}
            label="Emoji"
            value={<span className="text-2xl">{draftEmoji || "🎯"}</span>}
            onClick={openEditor("emoji")}
          />
          <ReviewRow
            icon={<CalendarCheck className="h-5 w-5 text-muted-foreground" />}
            label="Plan Type"
            value={
              draftOutlineType === "SPECIFIC" ? "Specific sessions" : "Times per week"
            }
            detail={
              draftOutlineType === "SPECIFIC"
                ? hasScheduledSessions
                  ? "Accepting will create dated sessions."
                  : "This is marked as session-based, but no dated sessions are included yet."
                : draftTimesPerWeek
                  ? `Accepting will create a ${draftTimesPerWeek}x/week frequency target.`
                : "This is frequency-based, but the weekly cadence still needs to be set."
            }
            onClick={openEditor("planType")}
          />
          <ReviewRow
            icon={<CalendarCheck className="h-5 w-5 text-muted-foreground" />}
            label="Frequency"
            value={
              draftTimesPerWeek
                ? `${draftTimesPerWeek}x per week`
                : hasScheduledSessions
                  ? `${sessions.length} scheduled session${sessions.length === 1 ? "" : "s"}`
                  : "Not set"
            }
            detail={
              draftTimesPerWeek
                ? "This weekly target will be saved on the plan."
                : "No weekly target is included in this proposal."
            }
            onClick={openEditor("frequency")}
          />
          <ReviewRow
            icon={<Calendar className="h-5 w-5 text-muted-foreground" />}
            label="Finishing Date"
            value={formatDate(draftFinishingDate) || "No end date"}
            detail={
              draftFinishingDate
                ? "Accepting will save this as the plan end date."
                : "No deadline is being set by this proposal."
            }
            onClick={openEditor("finishingDate")}
          />
          <ReviewRow
            icon={<Dumbbell className="h-5 w-5 text-muted-foreground" />}
            label="Activities"
            value={
              currentDraft.activities.length > 0 ? (
                <div className="space-y-1">
                  <div>{currentDraft.activities.length} selected</div>
                  {currentDraft.activities.map((activity, index) => (
                    <div key={`${activity.title}-${index}`} className="text-muted-foreground">
                      {activity.emoji} {activity.title}
                      {isNewActivity(activity) ? " (new)" : ""} · {activity.measure}
                    </div>
                  ))}
                </div>
              ) : (
                "None"
              )
            }
            detail={
              currentDraft.activities.length === 0
                ? "No activities selected."
                : newActivityCount > 0
                  ? "Accepting will create the marked new activities and reuse the rest."
                  : "All selected activities already exist and will be reused."
            }
            onClick={openEditor("activities")}
          />
          <ReviewRow
            icon={<Flag className="h-5 w-5 text-muted-foreground" />}
            label="Milestones"
            value={
              visibleMilestones.length > 0
                ? (
                  <div className="space-y-1">
                    <div>
                      {visibleMilestones.length} milestone{visibleMilestones.length === 1 ? "" : "s"}
                    </div>
                    {visibleMilestones.map((milestone) => (
                      <div
                        key={`${milestone.description}-${milestone.date || ""}`}
                        className="text-muted-foreground"
                      >
                        {milestone.description}
                        {milestone.date ? ` · ${formatDate(milestone.date)}` : ""}
                      </div>
                    ))}
                  </div>
                )
                : "None"
            }
          />
          <ReviewRow
            icon={<CheckCircle2 className="h-5 w-5 text-muted-foreground" />}
            label="Sessions"
            value={
              hasScheduledSessions ? (
                <div className="space-y-1">
                  <div>{sessions.length} planned</div>
                  <div className="text-muted-foreground">
                    Tap a planned day below to inspect the session guide.
                  </div>
                </div>
              ) : (
                "Not scheduled"
              )
            }
          />
          {hasScheduledSessions && calendarActivities.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <CalendarCheck className="h-4 w-4" />
                Upcoming sessions
              </div>
              <CalendarGrid
                sessions={calendarSessions}
                activities={calendarActivities}
                showLegend={false}
                visibleStartDate={firstSessionDate}
                weekLabels={{ week1: "This week", week2: "Next week" }}
              />
            </div>
          )}
          <ReviewRow
            icon={<Info className="h-5 w-5 text-muted-foreground" />}
            label="Notes"
            value={
              draftNote.trim() ? (
                <PlanNotesBlock notes={draftNote.trim()} />
              ) : (
                "None"
              )
            }
            onClick={openEditor("note")}
          />
        </div>

        <div className="shrink-0 border-t border-border bg-background px-1 pt-4">
          {isResolved ? (
            isAccepted && acceptedPlanId ? (
              <Button type="button" className="w-full" onClick={handleSeeFullPlan}>
                See full plan
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <div className="flex items-center justify-center gap-2 rounded-xl bg-muted/40 py-3 text-sm text-muted-foreground">
                {isAccepted ? (
                  <Check size={16} className="text-green-500" />
                ) : isCancelled ? (
                  <X size={16} className="text-muted-foreground" />
                ) : isChangesRequested ? (
                  <RefreshCw size={16} className="text-primary" />
                ) : (
                  <X size={16} className="text-red-500" />
                )}
                {isAccepted
                  ? "Plan proposal accepted"
                  : isCancelled
                    ? "Plan proposal replaced by a newer one"
                  : isChangesRequested
                    ? "Changes proposed"
                    : "Plan proposal rejected"}
              </div>
            )
          ) : (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleReject}
                disabled={isLoading}
              >
                <X className="mr-2 h-4 w-4" />
                Reject
              </Button>
              {hasDraftChanges ? (
                <Button
                  className="flex-1"
                  onClick={handleProposeChanges}
                  disabled={isProposingChanges}
                >
                  {isProposingChanges ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-2 h-4 w-4" />
                  )}
                  Propose Changes
                </Button>
              ) : (
                <Button className="flex-1" onClick={handleAccept} disabled={isLoading}>
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-2 h-4 w-4" />
                  )}
                  Create Plan
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </AppleLikePopover>
  );

  if (isRejected) {
    return (
      <>
        <button
          type="button"
          onClick={() => setIsDrawerOpen(true)}
          className="mt-2 flex w-full items-center gap-2 rounded-lg bg-muted/30 px-3 py-2 text-left opacity-60"
        >
          <span className="flex-1 text-sm text-muted-foreground line-through">{compactLabel}</span>
          <X size={14} className="flex-shrink-0 text-red-500" />
        </button>
        {reviewDrawer}
        {editorDrawer}
      </>
    );
  }

  if (isAccepted) {
    return (
      <>
        <button
          type="button"
          onClick={() => setIsDrawerOpen(true)}
          className="mt-2 flex w-full items-center gap-2 rounded-lg bg-muted/30 px-3 py-2 text-left opacity-60"
        >
          <span className="flex-1 text-sm text-foreground/70">{compactLabel}</span>
          <Check size={14} className="flex-shrink-0 text-green-500" />
        </button>
        {reviewDrawer}
        {editorDrawer}
      </>
    );
  }

  if (isChangesRequested) {
    return (
      <>
        <button
          type="button"
          onClick={() => setIsDrawerOpen(true)}
          className="mt-2 flex w-full items-center gap-2 rounded-lg bg-muted/30 px-3 py-2 text-left opacity-70"
        >
          <span className="flex-1 text-sm text-foreground/70">{compactLabel}</span>
          <RefreshCw size={14} className="flex-shrink-0 text-primary" />
        </button>
        {reviewDrawer}
        {editorDrawer}
      </>
    );
  }

  if (isCancelled) {
    return (
      <>
        <button
          type="button"
          onClick={() => setIsDrawerOpen(true)}
          className="mt-2 flex w-full items-center gap-2 rounded-lg bg-muted/30 px-3 py-2 text-left opacity-50"
        >
          <span className="flex-1 text-sm text-foreground/70 line-through">{compactLabel}</span>
          <X size={14} className="flex-shrink-0 text-muted-foreground" />
        </button>
        {reviewDrawer}
        {editorDrawer}
      </>
    );
  }

  return (
    <>
      <div className={`mt-2 w-full rounded-lg px-3 py-2.5 ${themeColors.fadedBg}`}>
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            className="min-w-0 flex-1 text-left"
          >
            <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Plus size={14} className="text-muted-foreground" />
              <span>{compactLabel}</span>
              <ChevronRight size={14} className="text-muted-foreground" />
            </div>
            {description && (
              <div className="mt-0.5 text-xs text-muted-foreground">
                {description}
              </div>
            )}
            <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
              <span>
                {effectiveOutlineType === "SPECIFIC" ? "specific" : "times/week"}
              </span>
              {timesPerWeek ? <span>{timesPerWeek}x/week</span> : null}
              {activities.map((activity) => (
                <span key={`${activity.title}-${activity.measure}`}>
                  {activity.emoji} {activity.title}
                  {isNewActivity(activity) ? " (new)" : ""} · {activity.measure}
                </span>
              ))}
            </div>
          </button>
          <div className="flex flex-shrink-0 items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30"
              onClick={handleReject}
              disabled={isLoading}
            >
              <X size={16} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-100 dark:hover:bg-green-900/30"
              onClick={handleAccept}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            </Button>
          </div>
        </div>
      </div>
      {reviewDrawer}
      {editorDrawer}
    </>
  );
}
