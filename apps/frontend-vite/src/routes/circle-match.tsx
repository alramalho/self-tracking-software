import { defaultPreferences, useCircleActions, useCircleMatch } from "@/components/circles/api";
import { ReasonChips } from "@/components/circles/components";
import { avatarColor } from "@/components/circles/model";
import { Orbit } from "@/components/circles/Orbit";
import { clearPendingMatch, readPendingMatch } from "@/components/circles/pendingMatch";
import type { CircleMatchSearch, OrbitPerson, PendingMatch } from "@/components/circles/types";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/contexts/users";
import { useThemeColors } from "@/hooks/useThemeColors";
import { getCoachAvatar } from "@/lib/coachPersonality";
import { toApiErrorMessage } from "@/utils/errorMessage";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/circle-match")({
  component: CircleMatchPage,
  validateSearch: (search: Record<string, unknown>): CircleMatchSearch => ({
    planId: typeof search.planId === "string" ? search.planId : "",
  }),
});

const emptySpot = (key: string): OrbitPerson => ({ key, label: "", color: "", empty: true });

// Shown once a plan exists: meet the circle that fits, or start one.
function CircleMatchPage() {
  const { planId } = Route.useSearch();
  const navigate = useNavigate();
  const theme = useThemeColors();
  const { currentUser } = useCurrentUser();
  const [pending] = useState<PendingMatch>(
    () => readPendingMatch(planId) ?? { planId, mode: "find", ...defaultPreferences }
  );
  const match = useCircleMatch(pending);
  const { joinCircle, startCircle } = useCircleActions();

  const toPlan = () => {
    clearPendingMatch();
    navigate({ to: "/plans", search: { selectedPlan: planId } });
  };
  // Joining or starting leaves you pending; the circle page asks for the first photo.
  const openCircle = (id: string) => {
    clearPendingMatch();
    const search = pending.mode === "invite" ? { proof: true, invite: true } : { proof: true };
    navigate({ to: "/circle/$id", params: { id }, search, replace: true });
  };
  const join = (circleId: string) =>
    joinCircle.mutate({ circleId, planId, preferences: pending }, { onSuccess: () => openCircle(circleId) });
  const start = () =>
    startCircle.mutate({ planId, preferences: pending }, { onSuccess: ({ id }) => openCircle(id) });

  // "Invite friends" in onboarding: start a circle straight away and copy its invite link.
  const startedInvite = useRef(false);
  useEffect(() => {
    if (pending.mode !== "invite" || startedInvite.current) return;
    startedInvite.current = true;
    start();
  });

  const me: OrbitPerson = {
    key: "me",
    label: currentUser?.name ?? currentUser?.username ?? "You",
    color: theme.hex,
    picture: currentUser?.picture,
    isMe: true,
  };
  const found = match.data?.state === "found" ? match.data.circle : null;
  const people: OrbitPerson[] = found
    ? [
        me,
        ...found.members.map((member, i) => ({
          key: `m${i}`,
          label: member.name ?? "?",
          color: avatarColor(member.name ?? String(i)),
          picture: member.picture,
        })),
      ]
    : [me, emptySpot("e1"), emptySpot("e2")];
  const waiting = match.data?.state === "none" ? match.data.similarPeople : 0;
  const busy = joinCircle.isPending || startCircle.isPending;
  const error = match.error ?? joinCircle.error ?? startCircle.error;
  const loading = match.isLoading || (pending.mode === "invite" && !startCircle.error);

  if (!planId)
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-muted-foreground">Pick a plan to find its circle.</p>
        <Button onClick={() => navigate({ to: "/plans", search: {} })}>Go to plans</Button>
      </div>
    );

  return (
    <div className="relative mx-auto flex min-h-full w-full max-w-lg flex-col">
      <div className="pointer-events-none absolute inset-x-0 top-0">
        <Orbit people={people} />
      </div>
      <div className="relative z-10 flex justify-end px-4 pt-2">
        <Button variant="ghost" size="icon" aria-label="Not now" onClick={toPlan} disabled={busy}>
          <X className="h-6 w-6 text-muted-foreground" />
        </Button>
      </div>
      <div className="flex flex-1 flex-col justify-end gap-[18px] px-6 pb-3 pt-[150px]">
        {loading && (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {error && (
          <p className="text-center text-sm text-red-500">
            {toApiErrorMessage(error)}{" "}
            {match.error && (
              <button type="button" className="underline" onClick={() => void match.refetch()}>
                Retry
              </button>
            )}
          </p>
        )}
        {found ? (
          <>
            <h1 className="text-center text-[32px] font-bold tracking-tight text-foreground">Meet your circle</h1>
            <div className="flex flex-col gap-2.5 rounded-[18px] bg-card border border-border p-4">
              <p className="text-[17px] font-semibold text-foreground">
                {found.emoji} {found.name}
              </p>
              <ReasonChips reasons={found.reasons} />
            </div>
            <div className="overflow-hidden rounded-[18px] bg-card border border-border">
              {found.members.map((member, i) => (
                <div
                  key={i}
                  className={`flex justify-between gap-3 px-4 py-3 ${i ? "border-t border-border" : ""}`}
                >
                  <span className="text-[15px] text-muted-foreground">{member.name}</span>
                  <span className="truncate text-right text-[15px] font-medium text-foreground">{member.goal}</span>
                </div>
              ))}
            </div>
            <p className="text-center text-[13px] text-muted-foreground">
              You're in once you post a photo from a session. They'll see this plan's week and logs, never your
              location.
            </p>
          </>
        ) : match.data?.state === "none" ? (
          <>
            <h1 className="text-center text-[32px] font-bold tracking-tight text-foreground">Start your circle</h1>
            <div className="flex items-center gap-3 rounded-[18px] bg-card border border-border p-3.5">
              <img
                src={getCoachAvatar(currentUser?.coachPersonality)}
                alt=""
                className="h-[52px] w-[52px] object-contain"
              />
              <p className="flex-1 text-[15px] leading-[21px] text-foreground">
                {waiting > 0
                  ? `${waiting} ${waiting === 1 ? "person" : "people"} with a similar goal ${waiting === 1 ? "is" : "are"} waiting too. I'll bring you together.`
                  : "No close match yet. I'll bring in people with a similar goal as they join."}
              </p>
            </div>
          </>
        ) : null}
      </div>
      {(found || match.data?.state === "none") && (
        <div className="flex flex-col gap-2 px-6 pb-3">
          <Button
            className="h-12 w-full rounded-full text-base"
            loading={busy}
            disabled={busy}
            onClick={() => (found ? join(found.id) : start())}
          >
            {found ? "Join" : "Start circle"}
          </Button>
          <button
            type="button"
            onClick={toPlan}
            disabled={busy}
            className="py-3 text-base text-muted-foreground hover:text-foreground"
          >
            Not now
          </button>
        </div>
      )}
    </div>
  );
}
