import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { alertFact } from "@tsw/prisma/follow-through/coach-inbox";
import { useApiWithAuth } from "@/api";
import { ActionDrawer, DrawerButton, DrawerHeader, DrawerOptions } from "@/components/drawer/ActionDrawer";
import type { DrawerOption } from "@/components/drawer/types";
import { startCoachAttentionAction } from "@/contexts/ai/service";
import { useCurrentUser } from "@/contexts/users";
import { getCoachPersonalityConfig } from "@/lib/coachPersonality";
import { MISS_REASONS, answeredMissedWeek, missMessage, missMessageStart, rememberMissAnswered } from "./missReasons";
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
  // The coach conversation opens with the message written, for the person to send.
  const talk = (coachPrompt?: string) => {
    onClose();
    navigate({ to: "/message-ai", search: coachPrompt ? { coachPrompt } : {} });
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
        const nudgeId = alert.nudge?.messageId;
        // A missed week is asked about once: after an answer, the drawer offers the conversation instead.
        const askReason = !!alert.missed && !answeredMissedWeek(plan.id) && !nudgeId;
        const reasons: DrawerOption[] = [
          ...MISS_REASONS.map((reason) => ({
            label: reason.label,
            onClick: () => {
              rememberMissAnswered(plan.id);
              talk(missMessage(plan.goal, reason.says));
            },
          })),
          {
            label: "Something else",
            onClick: () => {
              rememberMissAnswered(plan.id);
              talk(missMessageStart(plan.goal));
            },
          },
        ];
        return (
          <>
            <DrawerHeader emoji={activity?.emoji ?? plan.emoji} title={it.title} subtitle={alertFact(alert)} />
            {nudgeId ? (
              // The coach's own note leads; its two answers and the plan stay one tap away.
              <DrawerOptions
                options={[
                  { label: "Open coach message", onClick: () => talk() },
                  { label: "Remind me tomorrow", disabled: busy, onClick: () => post.mutate({ path: `/follow-through/nudges/${nudgeId}`, body: { action: "remind" } }) },
                  { label: "Let it go", disabled: busy, onClick: () => post.mutate({ path: `/follow-through/nudges/${nudgeId}`, body: { action: "archive" } }) },
                  { label: "Open plan", onClick: () => openPlan(plan.id) },
                ]}
              />
            ) : askReason ? (
              <DrawerOptions label="What got in the way?" options={reasons} />
            ) : (
              <DrawerOptions
                options={[
                  {
                    label: `Talk to ${coach.name}`,
                    onClick: () => talk(alert.status === "at_risk" ? `Help me fit the sessions left for "${plan.goal}" this week.` : undefined),
                  },
                  { label: "Open plan", onClick: () => openPlan(plan.id) },
                ]}
              />
            )}
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
              <DrawerButton label={`Open ${coach.name}'s message`} onClick={() => talk()} />
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
