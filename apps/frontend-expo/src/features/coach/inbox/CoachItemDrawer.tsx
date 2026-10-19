import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Status } from "@/components/ui";
import { Drawer, DrawerButton, DrawerHeader, DrawerOptions } from "@/components/drawer/Drawer";
import type { DrawerOption } from "@/components/drawer/types";
import { api } from "@/data/api";
import { useCurrentUser } from "@/data/queries";
import { coachIdentity } from "@/features/messages/coach";
import { latestCoachChat } from "@/features/messages/service";
import {
  MISS_REASONS,
  missMessage,
  missMessageStart,
  rememberMissAnswered,
} from "@/features/timeline/home-cards/miss-reasons";
import { alertFact } from "../model";
import type { CoachItem, CoachItemDrawerProps } from "../types";

type Opening = { prompt?: string; send?: boolean; planId?: string };

/** One coach item, opened: a centered title and one fact, the answers as options, one main button. */
export function CoachItemDrawer({ item, onClose, onCheckIn }: CoachItemDrawerProps) {
  const client = useQueryClient();
  const coach = coachIdentity(useCurrentUser().data?.coachPersonality);
  const done = async () => {
    await client.invalidateQueries();
    onClose();
  };
  const talk = useMutation({
    mutationFn: async ({ prompt, send, planId }: Opening) => {
      const chat = await latestCoachChat();
      onClose();
      router.push({
        pathname: "/chat/[id]",
        params: { id: chat.id, type: "COACH", ...(planId ? { planId } : {}), ...(prompt ? { prompt } : {}), ...(send ? { send: "1" } : {}) },
      });
    },
  });
  const post = useMutation({
    mutationFn: async ({ path, body }: { path: string; body: unknown }) => api.post(path, body),
    onSuccess: done,
  });
  const openChat = (chatId: string, messageId: string, planId?: string) => {
    onClose();
    router.push({ pathname: "/chat/[id]", params: { id: chatId, messageId, type: "COACH", ...(planId ? { planId } : {}) } });
  };
  if (!item) return null;
  const busy = talk.isPending || post.isPending;
  return (
    <Drawer visible label={item.title} onClose={onClose}>
      {content(item)}
      <Status error={talk.error ?? post.error} />
    </Drawer>
  );

  function content(it: CoachItem) {
    switch (it.kind) {
      case "alert": {
        const { alert } = it;
        const plan = alert.plan;
        const activity = plan.activities[0];
        const askReason = alert.status === "missed" || (!!alert.missed && !alert.nudge);
        const reasons: DrawerOption[] = [
          ...MISS_REASONS.map((reason) => ({
            label: reason.label,
            disabled: busy,
            onPress: () =>
              talk.mutate(
                { prompt: missMessage(plan.goal, reason.says), send: true, planId: plan.id },
                { onSuccess: () => void rememberMissAnswered(plan.id) },
              ),
          })),
          {
            label: "Something else",
            disabled: busy,
            onPress: () =>
              talk.mutate({ prompt: missMessageStart(plan.goal), planId: plan.id }, { onSuccess: () => void rememberMissAnswered(plan.id) }),
          },
        ];
        const nudgeId = alert.nudge?.messageId;
        return (
          <>
            <DrawerHeader emoji={activity?.emoji ?? plan.emoji} title={it.title} subtitle={alertFact(alert)} />
            {nudgeId ? (
              <DrawerOptions
                options={[
                  { label: "Remind me tomorrow", disabled: busy, onPress: () => post.mutate({ path: `/follow-through/nudges/${nudgeId}`, body: { action: "remind" } }) },
                  { label: "Let it go", disabled: busy, onPress: () => post.mutate({ path: `/follow-through/nudges/${nudgeId}`, body: { action: "archive" } }) },
                ]}
              />
            ) : askReason ? (
              <DrawerOptions label="What got in the way?" options={reasons} />
            ) : (
              <DrawerOptions
                options={[{ label: `Talk to ${coach.name}`, disabled: busy, onPress: () => talk.mutate({ planId: plan.id, prompt: `Help me fit the sessions left for "${plan.goal}" this week.` }) }]}
              />
            )}
            <DrawerButton
              testID="coach-item-log"
              label={`Log ${activity?.title.toLowerCase() ?? "a session"}`}
              onPress={() => {
                onClose();
                router.push({ pathname: "/(tabs)/add", params: activity ? { activityId: activity.id } : {} });
              }}
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
                options={(["DONE", "PARTLY", "SKIPPED"] as const).map((outcome) => ({
                  label: outcome === "DONE" ? "Done" : outcome === "PARTLY" ? "Partly" : "Not this time",
                  disabled: busy,
                  onPress: () => post.mutate({ path: `/follow-through/sessions/${encodeURIComponent(sessionId)}/outcome`, body: { outcome } }),
                }))}
              />
            ) : request.chatId && request.messageId ? (
              <DrawerButton label={`Open ${coach.name}'s message`} onPress={() => openChat(request.chatId!, request.messageId!, plan?.id)} />
            ) : null}
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
                  ? (["DONE", "PARTLY", "SKIPPED"] as const).map((outcome) => ({
                      label: outcome === "DONE" ? "Done" : outcome === "PARTLY" ? "Partly" : "Not this time",
                      disabled: busy,
                      onPress: () =>
                        post.mutate({
                          path: `/follow-through/sessions/${encodeURIComponent(check.sessionId!)}/outcome`,
                          body: { outcome },
                        }),
                    }))
                  : [
                      { label: "Keep my plan", disabled: busy, onPress: () => answer("ANSWER") },
                      { label: "Not now", disabled: busy, onPress: () => answer("DISMISS") },
                    ]
              }
            />
          </>
        );
      }
      case "attention": {
        const { attention } = it;
        return (
          <>
            <DrawerHeader emoji={it.emoji} title={attention.title} subtitle={attention.planGoal} />
            <DrawerOptions
              options={[
                {
                  label: "Not now",
                  disabled: busy,
                  onPress: () => post.mutate({ path: "/ai/coach/attention/dismiss", body: { dedupeKey: attention.dedupeKey } }),
                },
              ]}
            />
            <DrawerButton
              label={`Update with ${coach.name}`}
              busy={talk.isPending}
              onPress={() => talk.mutate({ prompt: attention.primaryAction.prompt, planId: attention.planIds[0] })}
            />
          </>
        );
      }
      case "checkin":
        return (
          <>
            <DrawerHeader
              emoji={it.emoji}
              title={it.title}
              subtitle={it.metrics.map((m) => `${m.emoji} ${m.title}`).join(" · ")}
            />
            <DrawerButton
              testID="coach-checkin"
              label="Check in"
              onPress={() => {
                onClose();
                onCheckIn?.();
              }}
            />
          </>
        );
    }
  }
}
