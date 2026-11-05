import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { alertFact } from "@tsw/prisma/follow-through/coach-inbox";
import { useApiWithAuth } from "@/api";
import { ActionDrawer, DrawerButton, DrawerHeader, DrawerOptions } from "@/components/drawer/ActionDrawer";
import type { DrawerOption } from "@/components/drawer/types";
import { startCoachAttentionAction } from "@/contexts/ai/service";
import { useCurrentUser } from "@/contexts/users";
import { getCoachPersonalityConfig } from "@/lib/coachPersonality";
import { MISS_REASONS, rememberMissAnswered } from "./missReasons";
import type { TalkReason } from "./talk/types";
import type { CoachItem, CoachItemDrawerProps } from "./types";

const OUTCOMES = [
  { label: "Done", outcome: "DONE" },
  { label: "Partly", outcome: "PARTLY" },
  { label: "Not this time", outcome: "SKIPPED" },
] as const;

const errorText = (error: unknown) =>
  (error as { response?: { data?: { error?: string } } })?.response?.data?.error ??
  (error instanceof Error ? error.message : null);

/** One coach item, opened: a centred title and one fact, the answers as options, one main button. */
export function CoachItemDrawer({ item, onClose, onCheckIn }: CoachItemDrawerProps) {
  const api = useApiWithAuth();
  const client = useQueryClient();
  const navigate = useNavigate();
  const { currentUser } = useCurrentUser();
  const coach = getCoachPersonalityConfig(currentUser?.coachPersonality);
  const post = useMutation({
    mutationFn: ({ path, body }: { path: string; body: unknown }) => api.post(path, body),
    onSuccess: async () => {
      await client.invalidateQueries();
      onClose();
    },
  });
  const attention = useMutation({
    mutationFn: (dedupeKey: string) => startCoachAttentionAction(api, { dedupeKey }),
    onSuccess: () => {
      onClose();
      navigate({ to: "/message-ai" });
    },
  });
  const openChat = () => {
    onClose();
    navigate({ to: "/message-ai" });
  };
  // Every answer to "What got in the way?" opens Talk to coach, one screen at a time.
  const talkAbout = (planId: string, reason: TalkReason, missed: boolean) => {
    if (missed) rememberMissAnswered(planId);
    onClose();
    navigate({ to: "/talk-to-coach", search: { planId, reason } });
  };
  const openPlan = (planId: string) => {
    onClose();
    navigate({ to: "/plans", search: { selectedPlan: planId } });
  };
  const logActivity = (activityId?: string) => {
    onClose();
    navigate({ to: "/add", search: activityId ? { activityId } : {} });
  };
  if (!item) return null;
  const busy = post.isPending || attention.isPending;
  const error = errorText(post.error ?? attention.error);
  return (
    <ActionDrawer open label={item.title} onClose={onClose}>
      {content(item)}
      {error && <p className="text-center text-sm text-red-600">{error}</p>}
    </ActionDrawer>
  );

  function content(it: CoachItem) {
    switch (it.kind) {
      case "alert": {
        const { alert } = it;
        const plan = alert.plan;
        const activity = plan.activities[0];
        const missed = alert.status === "missed";
        const reasons: DrawerOption[] = [
          ...MISS_REASONS.map((reason) => ({ label: reason.label, onClick: () => talkAbout(plan.id, reason.id, missed) })),
          { label: "Something else", onClick: () => talkAbout(plan.id, "other", missed) },
        ];
        return (
          <>
            <DrawerHeader emoji={activity?.emoji ?? plan.emoji} title={it.title} subtitle={alertFact(alert)} />
            <DrawerOptions label="What got in the way?" options={reasons} />
            <DrawerOptions
              options={[
                { label: `Talk to ${coach.name}`, onClick: () => talkAbout(plan.id, "talk", missed) },
                { label: "Open plan", onClick: () => openPlan(plan.id) },
              ]}
            />
            <DrawerButton
              testId="coach-item-log"
              label={`Log ${activity?.title.toLowerCase() ?? "a session"}`}
              onClick={() => logActivity(activity?.id)}
            />
          </>
        );
      }
      case "request": {
        const { request, plan } = it;
        const sessionId = request.kind === "session" ? request.sessionId : undefined;
        return (
          <>
            <DrawerHeader emoji={it.emoji} title={it.title} subtitle={plan?.goal} />
            {sessionId ? (
              <DrawerOptions
                options={OUTCOMES.map(({ label, outcome }) => ({
                  label,
                  disabled: busy,
                  onClick: () => post.mutate({ path: `/follow-through/sessions/${encodeURIComponent(sessionId)}/outcome`, body: { outcome } }),
                }))}
              />
            ) : (
              <DrawerButton label={`Open ${coach.name}'s message`} onClick={openChat} />
            )}
          </>
        );
      }
      case "check": {
        const { check } = it;
        const answer = (action: "ANSWER" | "DISMISS") =>
          post.mutate({ path: `/follow-through/checks/${encodeURIComponent(check.id)}`, body: { action } });
        return (
          <>
            <DrawerHeader emoji={it.emoji} title={check.message} subtitle={it.plan?.goal} />
            <DrawerOptions
              options={
                check.sessionId
                  ? OUTCOMES.map(({ label, outcome }) => ({
                      label,
                      disabled: busy,
                      onClick: () =>
                        post.mutate({ path: `/follow-through/sessions/${encodeURIComponent(check.sessionId!)}/outcome`, body: { outcome } }),
                    }))
                  : [
                      { label: "Keep my plan", disabled: busy, onClick: () => answer("ANSWER") },
                      { label: "Not now", disabled: busy, onClick: () => answer("DISMISS") },
                    ]
              }
            />
          </>
        );
      }
      case "attention":
        return (
          <>
            <DrawerHeader emoji={it.emoji} title={it.attention.title} subtitle={it.attention.planGoal} />
            <DrawerOptions
              options={[
                {
                  label: "Not now",
                  disabled: busy,
                  onClick: () => post.mutate({ path: "/ai/coach/attention/dismiss", body: { dedupeKey: it.attention.dedupeKey } }),
                },
              ]}
            />
            <DrawerButton
              label={`Update with ${coach.name}`}
              busy={attention.isPending}
              onClick={() => attention.mutate(it.attention.dedupeKey)}
            />
          </>
        );
      case "checkin":
        return (
          <>
            <DrawerHeader
              emoji={it.emoji}
              title={it.title}
              subtitle={it.metrics.map((m) => `${m.emoji} ${m.title}`).join(" · ")}
            />
            <DrawerButton
              testId="coach-checkin"
              label="Check in"
              onClick={() => {
                onClose();
                onCheckIn?.();
              }}
            />
          </>
        );
    }
  }
}
