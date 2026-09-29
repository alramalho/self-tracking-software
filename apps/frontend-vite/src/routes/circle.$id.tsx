import { inviteLink, useCircle, useCircleActions } from "@/components/circles/api";
import { CircleFeedList } from "@/components/circles/board/CircleFeedList";
import { RenameCircleDialog } from "@/components/circles/board/RenameCircleDialog";
import { CirclePanel, MemberRow } from "@/components/circles/components";
import { daysLeftLabel, firstName, recapLine } from "@/components/circles/model";
import type { BoardMember, CircleBoardSearch } from "@/components/circles/types";
import ConfirmDialogOrPopover from "@/components/ConfirmDialogOrPopover";
import { ActionSheet } from "@/components/safety/ActionSheet";
import { ReportDialog } from "@/components/safety/ReportDialog";
import type { ActionSheetContent, ReportTarget } from "@/components/safety/types";
import { personLabel, useBlockUser } from "@/components/safety/useBlockUser";
import { Button } from "@/components/ui/button";
import { usePlans } from "@/contexts/plans";
import { useCurrentUser } from "@/contexts/users";
import { useClipboard } from "@/hooks/useClipboard";
import { useThemeColors } from "@/hooks/useThemeColors";
import { getCoachAvatar } from "@/lib/coachPersonality";
import { cn } from "@/lib/utils";
import { toApiErrorMessage } from "@/utils/errorMessage";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, Flame, Loader2, MoreHorizontal, UserPlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

export const Route = createFileRoute("/circle/$id")({
  component: CirclePage,
  validateSearch: (search: Record<string, unknown>): CircleBoardSearch => ({
    invite: search.invite === true || search.invite === "true" || undefined,
    proof: search.proof === true || search.proof === "true" || search.proof === 1 || search.proof === "1" || undefined,
  }),
});

function CirclePage() {
  const { id } = Route.useParams();
  const { invite, proof } = Route.useSearch();
  const navigate = useNavigate();
  const theme = useThemeColors();
  const { currentUser } = useCurrentUser();
  const board = useCircle(id);
  const { plans } = usePlans();
  const { nudge, updateCircle, leaveCircle, removeMember, skipProof } = useCircleActions();
  const blockUser = useBlockUser();
  const [, copy] = useClipboard();
  const [sheet, setSheet] = useState<ActionSheetContent | null>(null);
  const [report, setReport] = useState<ReportTarget>();
  const [renaming, setRenaming] = useState(false);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const data = board.data;
  const isOwner = data?.me.role === "OWNER";
  const myId = currentUser?.id;

  const copyInvite = async () => {
    if (!data) return;
    const copied = await copy(inviteLink(data.inviteCode));
    if (copied) toast.success("Invite link copied");
    else toast.error("Couldn't copy the link. Try Invite friends again.");
  };

  // Straight from "Invite friends" in onboarding: copy the link once.
  const invited = useRef(false);
  useEffect(() => {
    if (invite && data && !invited.current) {
      invited.current = true;
      void copyInvite();
    }
  });

  // Right after joining, leaving without starting a log counts as "Later", so the coach can remind them.
  const [proofDismissed, setProofDismissed] = useState(false);
  const proofHandled = useRef(false);
  const stillPending = useRef(false);
  stillPending.current = !!data?.me.pending;
  const skipProofOnce = () => {
    if (proofHandled.current) return;
    proofHandled.current = true;
    skipProof.mutate(id);
  };
  useEffect(
    () => () => {
      if (proof && stillPending.current) skipProofOnce();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, proof]
  );
  const later = () => {
    setProofDismissed(true);
    skipProofOnce();
  };
  const logWithPhoto = () => {
    proofHandled.current = true;
    const myPlan = plans?.find((plan) => plan.id === data?.me.planId);
    const activityId = myPlan?.activities?.[0]?.id;
    navigate({ to: "/add", search: activityId ? { activityId } : {} });
  };

  const onError = (error: unknown) => toast.error(toApiErrorMessage(error));
  const nudgeMember = (member: BoardMember) =>
    nudge.mutate(
      { circleId: id, userId: member.user.id },
      { onSuccess: () => toast.success(`Nudged ${firstName(member.user)}`), onError }
    );
  const leave = () =>
    leaveCircle.mutate(id, {
      onSuccess: () => navigate({ to: "/plans", search: { selectedPlan: data?.me.planId } }),
      onError,
    });

  const openMemberMenu = (member: BoardMember) => {
    const name = firstName(member.user);
    const canNudge = member.week.toGo > 0 && !member.week.isNew && !member.nudgedToday;
    const username = member.user.username;
    setSheet({
      title: `${name} · ${member.week.done} of ${member.week.target} this week`,
      actions: [
        ...(canNudge ? [{ label: `Nudge ${name}`, onPress: () => nudgeMember(member) }] : []),
        ...(username
          ? [{ label: "View profile", onPress: () => navigate({ to: "/profile/$username", params: { username } }) }]
          : []),
        {
          label: `Report ${name}`,
          destructive: true,
          onPress: () => setReport({ kind: "USER", id: member.user.id, label: personLabel(member.user) }),
        },
        { label: `Block ${name}`, destructive: true, onPress: () => blockUser(member.user) },
        ...(isOwner
          ? [
              {
                label: `Remove ${name} from the circle`,
                destructive: true,
                onPress: () => removeMember.mutate({ circleId: id, userId: member.user.id }, { onError }),
              },
            ]
          : []),
      ],
    });
  };

  const openCircleMenu = () => {
    if (!data) return;
    setSheet({
      title: `${data.emoji} ${data.name}`,
      actions: [
        { label: "Invite friends", onPress: () => void copyInvite() },
        ...(isOwner ? [{ label: "Rename", onPress: () => setRenaming(true) }] : []),
        {
          label: "Report circle",
          destructive: true,
          onPress: () => setReport({ kind: "CIRCLE", id: data.id, label: "this circle" }),
        },
        { label: "Leave circle", destructive: true, onPress: () => setConfirmingLeave(true) },
      ],
    });
  };

  const forming = data?.status === "FORMING";
  const daysLeft = data?.members.find((member) => member.user.id === myId)?.week.daysLeft;
  const subtitle = data
    ? [`${data.members.length} of ${data.cap}`, data.place, data.paceLabel].filter(Boolean).join(" · ")
    : "";
  const coachAvatar = getCoachAvatar(currentUser?.coachPersonality);

  return (
    <div className="container mx-auto flex max-w-2xl flex-col gap-3 p-4">
      <header className="flex items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="Back" onClick={() => window.history.back()}>
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold text-foreground">
            {data ? `${data.emoji} ${data.name}` : "Circle"}
          </h1>
          {subtitle && <p className="truncate text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {data && (
          <Button variant="ghost" size="icon" aria-label="Circle options" onClick={openCircleMenu}>
            <MoreHorizontal className="h-6 w-6" />
          </Button>
        )}
      </header>

      {board.isLoading && (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      {board.error && (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-muted-foreground">{toApiErrorMessage(board.error, "Couldn't load this circle.")}</p>
          <Button variant="outline" onClick={() => void board.refetch()}>
            Retry
          </Button>
        </div>
      )}

      {data && (
        <>
          {data.me.pending && !proofDismissed && (
            <CirclePanel className="flex items-center gap-3">
              <img src={coachAvatar} alt="" className="h-[52px] w-[52px] object-contain" />
              <div className="flex flex-1 flex-col gap-2">
                <p className="text-base font-semibold text-foreground">You're almost in</p>
                <p className="text-sm text-muted-foreground">
                  Post a photo from a session to join. Members see you once it's up, and it's your intro.
                </p>
                <Button className="w-full" onClick={logWithPhoto}>
                  Log with a photo
                </Button>
                <button
                  type="button"
                  onClick={later}
                  className="py-1.5 text-[15px] text-muted-foreground hover:text-foreground"
                >
                  Later
                </button>
              </div>
            </CirclePanel>
          )}

          {forming ? (
            <CirclePanel>
              <p className="text-base font-semibold text-foreground">Forming</p>
              <p className="text-sm text-muted-foreground">The weekly board starts once 3 people are in.</p>
              {data.members.map((member) => {
                const isMe = member.user.id === myId;
                return (
                  <MemberRow
                    key={member.user.id}
                    member={{ ...member, week: { ...member.week, isNew: true } }}
                    isMe={isMe}
                    onPress={isMe ? undefined : () => openMemberMenu(member)}
                  />
                );
              })}
              {Array.from({ length: Math.max(0, 3 - data.members.length) }, (_, i) => (
                <div key={i} className="flex items-center gap-2.5 py-2.5">
                  <span className="h-[34px] w-[34px] rounded-full border-[1.5px] border-dashed border-muted-foreground" />
                  <span className="text-[15px] text-muted-foreground">Open spot</span>
                </div>
              ))}
            </CirclePanel>
          ) : (
            <>
              {data.togetherStreak > 0 && (
                <CirclePanel className="flex items-center gap-3">
                  <Flame className="h-[26px] w-[26px]" color="#ff9500" />
                  <div className="flex-1">
                    <p className="text-base font-semibold text-foreground">
                      {data.togetherStreak === 1 ? "1 week together" : `${data.togetherStreak} weeks together`}
                    </p>
                    <p className="text-sm text-muted-foreground">Everyone hit their week</p>
                  </div>
                </CirclePanel>
              )}
              <CirclePanel>
                <div className="flex justify-between">
                  <p className="text-base font-semibold text-foreground">This week</p>
                  {daysLeft !== undefined && <p className="text-sm text-muted-foreground">{daysLeftLabel(daysLeft)}</p>}
                </div>
                {data.members.map((member) => {
                  const isMe = member.user.id === myId;
                  return (
                    <MemberRow
                      key={member.user.id}
                      member={member}
                      isMe={isMe}
                      onPress={isMe ? undefined : () => openMemberMenu(member)}
                      onNudge={
                        !isMe && member.week.behind && !member.nudgedToday ? () => nudgeMember(member) : undefined
                      }
                    />
                  );
                })}
              </CirclePanel>
              {data.recap && (
                <CirclePanel className="flex items-center gap-3">
                  <img src={coachAvatar} alt="" className="h-11 w-11 object-contain" />
                  <div className="flex-1">
                    <p className="text-[15px] font-semibold text-foreground">Last week</p>
                    <p className="text-sm text-muted-foreground">{recapLine(data.recap, data.togetherStreak)}</p>
                  </div>
                </CirclePanel>
              )}
            </>
          )}

          <button
            type="button"
            onClick={() => void copyInvite()}
            className="flex items-center gap-3 py-3 text-left transition-opacity hover:opacity-60"
          >
            <UserPlus className={cn("h-[22px] w-[22px]", theme.text)} />
            <span className="flex flex-1 flex-col">
              <span className="text-base text-foreground">Invite friends</span>
              <span className="text-sm text-muted-foreground">{`${data.members.length} of ${data.cap} spots used`}</span>
            </span>
          </button>

          <h2 className="text-lg font-semibold text-foreground">Latest</h2>
          <CircleFeedList circleId={id} />

          <RenameCircleDialog
            open={renaming}
            currentName={data.name}
            onClose={() => setRenaming(false)}
            onSave={(name) => updateCircle.mutateAsync({ circleId: id, changes: { name } })}
          />
        </>
      )}

      <ActionSheet
        open={!!sheet}
        title={sheet?.title}
        actions={sheet?.actions ?? []}
        onClose={() => setSheet(null)}
      />
      <ReportDialog target={report} onClose={() => setReport(undefined)} />
      <ConfirmDialogOrPopover
        isOpen={confirmingLeave}
        onClose={() => setConfirmingLeave(false)}
        onConfirm={leave}
        isConfirming={leaveCircle.isPending}
        title="Leave this circle?"
        description="Your own history stays in your account."
        confirmText="Leave"
        cancelText="Cancel"
        variant="destructive"
      />
    </div>
  );
}
