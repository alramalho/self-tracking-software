import { inviteLink, useCircle, useCircleActions } from "@/components/circles/api";
import { MotivateDrawer } from "@/components/circles/MotivateDrawer";
import { CircleFeedList } from "@/components/circles/board/CircleFeedList";
import { RenameCircleDialog } from "@/components/circles/board/RenameCircleDialog";
import { CirclePanel, MemberRow, OpenSpots } from "@/components/circles/components";
import { InviteSheet } from "@/components/circles/InviteSheet";
import { daysLeftLabel, firstName, personColors } from "@/components/circles/model";
import { Orbit } from "@/components/circles/Orbit";
import { PastWeeksRow, PastWeeksSheet } from "@/components/circles/PastWeeks";
import type { BoardMember, CircleBoardSearch, OrbitPerson } from "@/components/circles/types";
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
import { Camera, ChevronLeft, Loader2, MessageCircle, MoreHorizontal, UserPlus } from "lucide-react";
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
  const { updateCircle, muteCircle, leaveCircle, removeMember, skipProof, openChat } = useCircleActions();
  const blockUser = useBlockUser();
  const [, copy] = useClipboard();
  const [sheet, setSheet] = useState<ActionSheetContent | null>(null);
  const [report, setReport] = useState<ReportTarget>();
  const [motivating, setMotivating] = useState<BoardMember>();
  const [renaming, setRenaming] = useState(false);
  const [pastWeeksOpen, setPastWeeksOpen] = useState(false);
  const [inviting, setInviting] = useState(false);
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
  const openCircleChat = () =>
    openChat.mutate(id, {
      onSuccess: ({ chatId }) => navigate({ to: "/chat/$chatId", params: { chatId } }),
      onError,
    });
  const leave = () =>
    leaveCircle.mutate(id, {
      onSuccess: () => navigate({ to: "/plans", search: { selectedPlan: data?.me.planId } }),
      onError,
    });

  const openMemberMenu = (member: BoardMember) => {
    const name = firstName(member.user);
    const canMotivate = !member.pending && member.week.toGo > 0 && !member.week.isNew;
    const username = member.user.username;
    setSheet({
      title: `${name} · ${member.week.done} of ${member.week.target} this week`,
      actions: [
        ...(canMotivate ? [{ label: `Motivate ${name}`, onPress: () => setMotivating(member) }] : []),
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
        { label: "Invite friends", onPress: () => setInviting(true) },
        ...(isOwner ? [{ label: "Rename", onPress: () => setRenaming(true) }] : []),
        ...(isOwner
          ? [
              {
                label: data.coachPosts ? "Turn off Helly's posts" : "Turn on Helly's posts",
                onPress: () =>
                  updateCircle.mutate({ circleId: id, changes: { coachPosts: !data.coachPosts } }, { onError }),
              },
            ]
          : []),
        {
          label: data.me.muted ? "Unmute notifications" : "Mute notifications",
          onPress: () => muteCircle.mutate({ circleId: id, muted: !data.me.muted }, { onError }),
        },
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
  // Who's in the circle, drifting on the orbit (same colours as the past-weeks chart),
  // with dashed spots while there's room.
  const colors = personColors(data?.members ?? []);
  const orbit: OrbitPerson[] = data
    ? [
        ...data.members.map((member) => ({
          key: member.user.id,
          label: firstName(member.user),
          color: colors[member.user.id],
          picture: member.user.picture,
          isMe: member.user.id === myId,
        })),
        ...Array.from({ length: Math.max(0, Math.min(3, data.cap - data.members.length)) }, (_, i) => ({
          key: `open-${i}`,
          label: "",
          color: "transparent",
          empty: true,
        })),
      ]
    : [];
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

          {!data.me.pending && <Orbit ring people={orbit} height={124} />}

          {forming ? (
            <CirclePanel>
              <p className="text-base font-semibold text-foreground">Forming</p>
              <p className="text-sm text-muted-foreground">The weekly board starts once 2 people have posted their first photo.</p>
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
              <OpenSpots members={data.members.length} onInvite={() => setInviting(true)} />
            </CirclePanel>
          ) : (
            <>
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
                      onMotivate={
                        !isMe && member.week.behind ? () => setMotivating(member) : undefined
                      }
                    />
                  );
                })}
                <OpenSpots members={data.members.length} onInvite={() => setInviting(true)} />
              </CirclePanel>
              <PastWeeksRow board={data} viewerId={myId} onPress={() => setPastWeeksOpen(true)} />
            </>
          )}

          <button
            type="button"
            onClick={() => setInviting(true)}
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

          {/* One main action: the circle chat for members, the first photo while pending. */}
          <div className="sticky bottom-[6.4rem] z-20 pt-2 md:bottom-4">
            {data.me.pending ? (
              <Button className="h-12 w-full rounded-full text-base" onClick={logWithPhoto}>
                <Camera className="mr-2 h-5 w-5" />
                Log with a photo
              </Button>
            ) : (
              <Button
                className={cn("h-12 w-full rounded-full text-base text-white", theme.bg)}
                loading={openChat.isPending}
                disabled={openChat.isPending}
                onClick={openCircleChat}
              >
                <MessageCircle className="mr-2 h-5 w-5" />
                Circle chat
              </Button>
            )}
          </div>

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
      {data && (
        <PastWeeksSheet board={data} viewerId={myId} open={pastWeeksOpen} onClose={() => setPastWeeksOpen(false)} />
      )}
      <InviteSheet
        circleId={id}
        open={inviting}
        onClose={() => setInviting(false)}
        onShareLink={() => void copyInvite()}
      />
      {motivating && <MotivateDrawer circleId={id} member={motivating} onClose={() => setMotivating(undefined)} />}
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
