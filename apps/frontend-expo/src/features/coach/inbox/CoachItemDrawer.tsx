import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Status } from "@/components/ui";
import { Drawer, DrawerButton, DrawerHeader, DrawerOptions } from "@/components/drawer/Drawer";
import type { DrawerOption } from "@/components/drawer/types";
import { api } from "@/data/api";
import { useCurrentUser } from "@/data/queries";
import { coachIdentity } from "@/features/messages/coach";
import { latestCoachChat } from "@/features/messages/service";
import { MISS_REASONS } from "@/features/timeline/home-cards/miss-reasons";
import type { TalkReason } from "../talk/types";
import { alertFact } from "../model";
import type { CoachChatOpening, CoachItem, CoachItemDrawerProps } from "../types";

/** One coach item, opened: a centered title and one fact, the answers as options, one main button. */
export function CoachItemDrawer({ item, onClose, onCheckIn }: CoachItemDrawerProps) {
  const client = useQueryClient();
  const coach = coachIdentity(useCurrentUser().data?.coachPersonality);
  const done = async () => {
    await client.invalidateQueries();
    onClose();
  };
  const talk = useMutation({
    mutationFn: async ({ prompt, planId }: CoachChatOpening) => {
      const chat = await latestCoachChat();
      onClose();
      router.push({
        pathname: "/chat/[id]",
        params: { id: chat.id, type: "COACH", ...(planId ? { planId } : {}), ...(prompt ? { prompt } : {}) },
      });
    },
  });
  // Every answer to "What got in the way?" opens Talk to coach, one screen at a time. The alert is
  // answered only when that conversation ends, on the server.
  const talkAbout = (planId: string, reason: TalkReason, missed: boolean) => {
    onClose();
    router.push({ pathname: "/talk-to-coach", params: { planId, reason, ...(missed ? { missed: "1" } : {}) } });
  };
  const post = useMutation({
    mutationFn: async ({ path, body }: { path: string; body: unknown }) => api.post(path, body),
    onSuccess: done,
  });
  const openPlan = (planId: string) => {
    onClose();
    router.push({ pathname: "/(tabs)/plans", params: { selectedPlan: planId } });
  };
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
        const missed = alert.status === "missed";
        const reasons: DrawerOption[] = [
          ...MISS_REASONS.map((r) => ({ label: r.label, emoji: r.emoji, onPress: () => void talkAbout(plan.id, r.id, missed) })),
          { label: "Something else", emoji: "💬", onPress: () => void talkAbout(plan.id, "other", missed) },
        ];
        return (
          <>
            <DrawerHeader emoji={activity?.emoji ?? plan.emoji} title={it.title} subtitle={alertFact(alert)} />
            <DrawerOptions label="What got in the way?" options={reasons} />
            <DrawerOptions
              options={[
                { label: `Talk to ${coach.name}`, onPress: () => void talkAbout(plan.id, "talk", missed) },
                { label: "Open plan", onPress: () => openPlan(plan.id) },
              ]}
            />
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
